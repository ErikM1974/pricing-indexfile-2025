/**
 * nav-dropdown.js — CLICK-to-open disclosure for the masthead mega dropdowns
 * (Products / Brands).
 *
 * Replaces hover-open (2026-07-13). Hover mega menus are finicky on desktop —
 * the small trigger and the full-width panel don't touch, so a diagonal toward
 * a far brand crossed a dead strip of bare nav bar and snapped the panel shut
 * before you could click ("diagonal death") — and they simply don't exist on
 * touch devices. Click-to-open is robust on mouse, touchscreen, and tablet
 * alike, never opens by accident, and is the clean disclosure pattern for the
 * keyboard / screen-reader path (aria-expanded on the trigger).
 *
 * Behavior: click a trigger to open; click it again, click another trigger,
 * click anywhere outside, or press Escape to close. Only one panel open at a
 * time. Panels are display:none below 960px (the mobile drawer takes over), so
 * this harmlessly no-ops there.
 *
 * CSS contract: the panel is shown by `.nav-item.nav-open > .nav-dropdown` in
 * nwca-2026-core.css — there is deliberately NO :hover open rule.
 */
(function () {
    'use strict';

    var items = []; // .nav-item elements that own a mega dropdown

    function setOpen(item, open) {
        item.classList.toggle('nav-open', open);
        var trigger = item.querySelector('.nav-link');
        if (trigger) trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function closeAll(except) {
        for (var i = 0; i < items.length; i++) {
            if (items[i] !== except && items[i].classList.contains('nav-open')) {
                setOpen(items[i], false);
            }
        }
    }

    function wire(item) {
        var trigger = item.querySelector('.nav-link');
        if (!trigger) return;

        function toggle(e) {
            e.preventDefault();          // the trigger is an <a> — don't navigate
            var willOpen = !item.classList.contains('nav-open');
            closeAll(item);              // never two full-width panels at once
            setOpen(item, willOpen);
        }

        trigger.addEventListener('click', toggle);
        // Enter fires click on an <a> natively; Space does not — support it.
        trigger.addEventListener('keydown', function (e) {
            if (e.key === ' ' || e.key === 'Spacebar') toggle(e);
        });

        items.push(item);
    }

    function init() {
        var candidates = document.querySelectorAll('.nav-menu .nav-item');
        for (var i = 0; i < candidates.length; i++) {
            if (candidates[i].querySelector('.nav-dropdown')) wire(candidates[i]);
        }
        if (!items.length) return;

        // Click outside any nav item closes the open panel.
        document.addEventListener('click', function (e) {
            if (!e.target.closest('.nav-menu .nav-item')) closeAll(null);
        });

        // Escape closes the open panel and returns focus to its trigger.
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            for (var i = 0; i < items.length; i++) {
                if (items[i].classList.contains('nav-open')) {
                    setOpen(items[i], false);
                    var t = items[i].querySelector('.nav-link');
                    if (t) t.focus();
                }
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
