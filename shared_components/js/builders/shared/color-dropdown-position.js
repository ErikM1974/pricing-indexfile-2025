/**
 * builders/shared/color-dropdown-position.js — viewport-fixed positioning for
 * the trio's color-picker dropdowns (P1 fix, 2026-07-10).
 *
 * The dropdown used `position:absolute` inside `.color-picker-wrapper`, so any
 * overflow ancestor (the product-table card) CLIPPED it — Erik's screenshot
 * showed 2.5 colors and the rest cut off below the card edge. Fixed-position
 * coordinates escape ancestor clipping entirely, and we flip ABOVE the trigger
 * when the viewport bottom is too close. One scroll/resize listener (capture)
 * keeps any open dropdown glued to its trigger — same idea as DTG's
 * positionPortaledMenu, without moving the element (so the pickers' existing
 * hover/click/keyboard wiring is untouched).
 */

/* global Element */

const MAX_MENU_HEIGHT = 280; // matches .color-picker-dropdown max-height in color-picker-shared.css

/** Pin an (already-visible) dropdown to its trigger in viewport coordinates. */
export function positionColorDropdown(trigger, dropdown) {
    if (!trigger || !dropdown) return;
    const r = trigger.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    dropdown.style.position = 'fixed';
    dropdown.style.left = r.left + 'px';
    dropdown.style.right = 'auto';
    dropdown.style.width = Math.max(r.width, 220) + 'px';
    if (!vh || vh <= 0) {
        // embedded/headless contexts can report 0 — just open below, unclamped
        dropdown.style.bottom = 'auto';
        dropdown.style.top = (r.bottom + 4) + 'px';
        return;
    }
    const spaceBelow = vh - r.bottom;
    if (spaceBelow < Math.min(MAX_MENU_HEIGHT, 300) && r.top > spaceBelow) {
        // open UPWARD — not enough room below and more room above
        dropdown.style.top = 'auto';
        dropdown.style.bottom = (vh - r.top + 4) + 'px';
        dropdown.style.maxHeight = Math.min(MAX_MENU_HEIGHT, r.top - 12) + 'px';
    } else {
        dropdown.style.bottom = 'auto';
        dropdown.style.top = (r.bottom + 4) + 'px';
        dropdown.style.maxHeight = Math.min(MAX_MENU_HEIGHT, spaceBelow - 12) + 'px';
    }
}

/** Re-pin every open dropdown (scroll/resize). Hidden ones are left alone —
 *  their stale coords don't matter under display:none and reopen recomputes. */
function repositionOpenDropdowns() {
    document.querySelectorAll('.color-picker-dropdown:not(.hidden)').forEach((dd) => {
        const wrap = dd.closest('.color-picker-wrapper');
        const trigger = wrap && wrap.querySelector('.color-picker-selected');
        if (trigger) positionColorDropdown(trigger, /** @type {HTMLElement} */ (dd));
    });
}

// Registered once per page bundle (this module is imported by the builder's
// product-rows module). Capture-phase so scrolls inside nested containers —
// including the dropdown's own list — still re-pin correctly.
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('scroll', (e) => {
        // scrolling INSIDE the dropdown list itself must not move the box
        const t = e.target;
        if (t instanceof Element && t.closest('.color-picker-dropdown')) return;
        repositionOpenDropdowns();
    }, true);
    window.addEventListener('resize', repositionOpenDropdowns);
}
