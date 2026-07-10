/* Purchasing from SanMar — ShopWorks Training Guide
 * Lightweight, dependency-free behaviour: print button, persistent checklists, back-to-top.
 * No pricing/API logic — this is a static reference page. */
(function () {
    'use strict';

    var STORAGE_PREFIX = 'sanmarPurchasing:checklist:';

    /* ── Print ──────────────────────────────────────────────────────── */
    document.querySelectorAll('[data-action="print"]').forEach(function (btn) {
        btn.addEventListener('click', function () { window.print(); });
    });

    /* ── Back to top ────────────────────────────────────────────────── */
    var topBtn = document.querySelector('[data-action="top"]');
    if (topBtn) {
        topBtn.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        window.addEventListener('scroll', function () {
            topBtn.classList.toggle('visible', window.scrollY > 600);
        }, { passive: true });
    }

    /* ── Smooth-scroll for in-page quick-nav links ──────────────────── */
    document.querySelectorAll('.quicknav a[href^="#"], a[href^="#sizes"]').forEach(function (link) {
        link.addEventListener('click', function (e) {
            var target = document.getElementById(this.getAttribute('href').slice(1));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                history.replaceState(null, '', this.getAttribute('href'));
            }
        });
    });

    /* ── Persistent checklists ──────────────────────────────────────── */
    function storageAvailable() {
        try {
            var t = '__sanmar_test__';
            window.localStorage.setItem(t, t);
            window.localStorage.removeItem(t);
            return true;
        } catch (err) {
            return false;
        }
    }
    var canStore = storageAvailable();

    document.querySelectorAll('[data-checklist]').forEach(function (grid) {
        var key = STORAGE_PREFIX + grid.getAttribute('data-checklist');
        var boxes = Array.prototype.slice.call(grid.querySelectorAll('input[type="checkbox"]'));

        // Restore
        if (canStore) {
            var saved = window.localStorage.getItem(key);
            if (saved) {
                var state = saved.split(',');
                boxes.forEach(function (box, i) { box.checked = state[i] === '1'; });
            }
        }

        // Persist on change
        function save() {
            if (!canStore) { return; }
            window.localStorage.setItem(key, boxes.map(function (b) { return b.checked ? '1' : '0'; }).join(','));
        }
        boxes.forEach(function (box) { box.addEventListener('change', save); });
    });

    // Reset buttons — data-reset can hold several space-separated checklist names
    document.querySelectorAll('[data-reset]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            btn.getAttribute('data-reset').split(/\s+/).forEach(function (name) {
                if (!name) { return; }
                var grid = document.querySelector('[data-checklist="' + name + '"]');
                if (!grid) { return; }
                grid.querySelectorAll('input[type="checkbox"]').forEach(function (box) { box.checked = false; });
                if (canStore) { window.localStorage.removeItem(STORAGE_PREFIX + name); }
            });
        });
    });
})();
