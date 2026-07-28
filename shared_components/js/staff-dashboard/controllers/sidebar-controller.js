/* =====================================================
   STAFF DASHBOARD v3 — SIDEBAR CONTROLLER
   Owns: collapse/expand of nav sections, persisted state,
   and the mobile hamburger overlay.
   ===================================================== */

import { register } from '../core/dashboard-events.js';
import { store }    from '../core/dashboard-store.js';

// Top-level sections AND the sub-groups inside them (Administration, 2026-07-28).
// One selector covers both: closest() resolves to the NEAREST collapsible, so a
// sub-group header toggles its own group and never its parent section.
const SECTION_SELECTOR = '.nav-section[data-section], .nav-subsection[data-subsection]';

// Sub-group keys are namespaced so they can never collide with a section key.
function getSectionKey(el) {
    return el.dataset.section || (el.dataset.subsection ? `sub:${el.dataset.subsection}` : '');
}

// Keep aria-expanded in sync with the visual state. The markup ships
// aria-expanded="false" but nothing used to update it, so screen readers were
// told every section was collapsed even while open — and the
// `[aria-expanded="true"]` styling in dashboard-v3-theme.css never fired.
function syncAria(section) {
    const header = section.querySelector(':scope > .nav-section-header, :scope > .nav-subsection-header');
    if (header) header.setAttribute('aria-expanded', String(!section.classList.contains('collapsed')));
}

function applyCollapseState(states) {
    document.querySelectorAll(SECTION_SELECTOR).forEach((section) => {
        const key = getSectionKey(section);
        if (key && key in states) {
            section.classList.toggle('collapsed', !!states[key]);
        }
        syncAria(section);
    });
}

function snapshotState() {
    const states = {};
    document.querySelectorAll(SECTION_SELECTOR).forEach((section) => {
        const key = getSectionKey(section);
        if (key) states[key] = section.classList.contains('collapsed');
    });
    return states;
}

function toggleSection(headerEl) {
    const section = headerEl.closest(SECTION_SELECTOR);
    if (!section) return;
    section.classList.toggle('collapsed');
    syncAria(section);
    store.set('sidebarSections', snapshotState());
}

function toggleMobileOverlay() {
    const sidebar = document.querySelector('.sidebar');
    const body = document.body;
    if (!sidebar) return;
    const open = sidebar.classList.toggle('is-open');
    body.classList.toggle('has-sidebar-open', open);
}

function closeMobileOverlay() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.remove('is-open');
    document.body.classList.remove('has-sidebar-open');
}

export function initSidebar() {
    // Restore collapse state. Always call applyCollapseState (even with no saved
    // state) so aria-expanded is seeded from the markup's actual classes.
    const saved = store.get('sidebarSections');
    applyCollapseState(saved && typeof saved === 'object' ? saved : {});

    // Close overlay when a nav-link is clicked (mobile)
    document.addEventListener('click', (e) => {
        if (e.target.closest('.sidebar .nav-link')) {
            closeMobileOverlay();
        }
    });

    // Close on backdrop click
    document.addEventListener('click', (e) => {
        if (e.target === document.body && document.body.classList.contains('has-sidebar-open')) {
            closeMobileOverlay();
        }
    });

    // Close on Esc
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMobileOverlay();
    });
}

// Register data-action handlers
register('sidebar:toggle-section', (el) => toggleSection(el));
register('sidebar:toggle-mobile',  () => toggleMobileOverlay());
register('sidebar:close-mobile',   () => closeMobileOverlay());
