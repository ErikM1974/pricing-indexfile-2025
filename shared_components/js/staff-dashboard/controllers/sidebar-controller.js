/* =====================================================
   STAFF DASHBOARD v3 — SIDEBAR CONTROLLER
   Owns: collapse/expand of nav sections, persisted state,
   and the mobile hamburger overlay.
   ===================================================== */

import { register } from '../core/dashboard-events.js';
import { store }    from '../core/dashboard-store.js';

const SECTION_SELECTOR = '.nav-section[data-section]';

function getSectionKey(el) {
    return el.dataset.section;
}

function applyCollapseState(states) {
    document.querySelectorAll(SECTION_SELECTOR).forEach((section) => {
        const key = getSectionKey(section);
        if (key in states) {
            section.classList.toggle('collapsed', !!states[key]);
        }
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
    // Restore collapse state
    const saved = store.get('sidebarSections');
    if (saved && typeof saved === 'object') {
        applyCollapseState(saved);
    }

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
