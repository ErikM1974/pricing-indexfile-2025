/* =====================================================
   STAFF DASHBOARD v3 — TOOL GRID CONTROLLER (2026-07-29)
   Owns two small jobs on the Quick Access zone:

   1. Category count badges, derived from the DOM instead of hand-typed.
   2. Collapse state for any [data-collapse-key] <details> on the page
      (Pride Wall, Reference card), persisted per browser.

   No network. No Caspio. localStorage only.
   ===================================================== */

import { store } from '../core/dashboard-store.js';

/* ── Count badges ────────────────────────────────────────────────────
   The badges used to be typed by hand and drifted the moment anyone
   added a link — Specialty Products read "5" over six buttons for two
   months. Counting unique hrefs (not anchors) matters: the Quoting card
   lists Quick Quote twice on purpose, once as its own row and once
   inside "All quoting tools", and it should still count as one tool.
   Disabled roadmap items are <span>, not <a>, so they fall out for free. */
function renderCountBadges() {
    document.querySelectorAll('.quick-access-grid .tool-category').forEach((card) => {
        const badge = card.querySelector('.tool-category-count');
        if (!badge) return;

        const hrefs = new Set();
        card.querySelectorAll('a.tool-btn[href]').forEach((a) => hrefs.add(a.getAttribute('href')));
        badge.textContent = String(hrefs.size);
    });
}

/* ── Persisted collapse for <details> widgets ────────────────────────
   Same shape as sidebar-controller's applyCollapseState/snapshotState,
   against the `widgetCollapse` store slot (declared since the store was
   written, unused until now). Stores OPEN state — the markup ships the
   sensible default (Pride Wall open, Reference closed) and a saved value
   only overrides it once someone has actually expressed a preference. */
const COLLAPSIBLE_SELECTOR = 'details[data-collapse-key]';

function applyCollapseState(states) {
    document.querySelectorAll(COLLAPSIBLE_SELECTOR).forEach((el) => {
        const key = el.dataset.collapseKey;
        if (key && key in states) el.open = !!states[key];
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
    renderCountBadges();
    initCollapsibles();
}
