/* =====================================================
   STAFF DASHBOARD v3 — COLLAPSE MEMORY (2026-07-29; trimmed 2026-09-04)
   One job: remember the open/closed state of every
   <details data-collapse-key> on the page — the Pride Wall and the
   "More" folds inside the workspace cards — per browser.

   (The category count badges this file also rendered died with the
   Quick Access grid on 2026-09-03; that code left on 2026-09-04.)

   No network. No Caspio. localStorage only.
   ===================================================== */

import { store } from '../core/dashboard-store.js';

/* Stores OPEN state — the markup ships the sensible default (Pride Wall open,
   folds closed) and a saved value only overrides it once someone has actually
   expressed a preference. */
const COLLAPSIBLE_SELECTOR = 'details[data-collapse-key]';

/* On a phone the Pride Wall pushed the first tool ~620px down the page
   (2026-09-04 review). With no saved preference it starts closed there; one
   tap opens it and that choice is remembered like any other. */
const PHONE_CLOSED_BY_DEFAULT = new Set(['prideWall']);
const PHONE = '(max-width: 768px)';

function applyCollapseState(states) {
    const onPhone = typeof window.matchMedia === 'function' && window.matchMedia(PHONE).matches;
    document.querySelectorAll(COLLAPSIBLE_SELECTOR).forEach((el) => {
        const key = el.dataset.collapseKey;
        if (!key) return;
        if (key in states) el.open = !!states[key];
        else if (onPhone && PHONE_CLOSED_BY_DEFAULT.has(key)) el.open = false;
    });
}

function snapshotCollapseState() {
    const states = {};
    document.querySelectorAll(COLLAPSIBLE_SELECTOR).forEach((el) => {
        const key = el.dataset.collapseKey;
        if (key) states[key] = el.open;
    });
    return states;
}

function initCollapsibles() {
    const saved = store.get('widgetCollapse');
    applyCollapseState(saved && typeof saved === 'object' ? saved : {});

    // These <details> are static markup — never re-rendered — so one
    // listener each at init is enough. `toggle` fires after el.open flips.
    document.querySelectorAll(COLLAPSIBLE_SELECTOR).forEach((el) => {
        el.addEventListener('toggle', () => {
            store.set('widgetCollapse', snapshotCollapseState());
        });
    });
}

export function initToolGrid() {
    initCollapsibles();
}
