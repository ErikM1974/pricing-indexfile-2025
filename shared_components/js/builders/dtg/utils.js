/**
 * DTG inline form — utils module (Batch 5, 2026-07-09). Moved VERBATIM from the
 * dtg-inline-form.js IIFE; lexical references became the imports below.
 */
// @ts-nocheck — MOVED legacy DOM code (pre-existing checkJs frictions).
/* global markAsUnsaved, */
import { SALES_REPS, SHIP_METHODS, SUPPORTED_COMBOS, state } from './state.js';

export function repByCode(code) {
    return SALES_REPS.find(r => r.code === code) || SALES_REPS[1]; // default Erik
}

export function shipLabel(code) {
    const m = SHIP_METHODS.find(x => x.code === code);
    return m ? m.label : 'Customer Pickup';
}

export function isPickupMethod(method) {
    // Centralized check — covers ShopWorks-canonical "Customer Pickup"
    // PLUS the legacy 'pickup' / 'willcall' codes used in share-link
    // drafts before v2026.05.20.7. Once those drafts age out, can
    // collapse to just the first equality.
    return method === 'Customer Pickup' || method === 'pickup' || method === 'willcall';
}

// --- Date helpers (Erik 2026-05-20) -------------------------------------
// ISO date "YYYY-MM-DD" matches HTML <input type="date"> serialization
// AND ManageOrders push (proxy reformats to MM/DD/YYYY on its side).
export function isoDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

// Add N business days (Mon-Fri only). NOTE: doesn't account for US holidays —
// rep is expected to bump the date manually for holiday weeks (Thanksgiving,
// Xmas). Worth adding a holiday-aware version if reps complain.
export function addBusinessDays(start, days) {
    const d = new Date(start);
    let added = 0;
    while (added < days) {
        d.setDate(d.getDate() + 1);
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) added++;
    }
    return d;
}

// Erik's rule: ≤ 24 pcs → 5 business days; > 24 pcs → 10 business days.
export function computeAutoDueDate(combinedQty) {
    const bizDays = combinedQty > 24 ? 10 : 5;
    return isoDate(addBusinessDays(new Date(), bizDays));
}

// Human-readable label for the auto-due hint shown next to the field.
export function dueDateAutoLabel(combinedQty) {
    if (combinedQty <= 0) return '5 business days (auto)';
    return combinedQty > 24
        ? `10 business days (auto · 25+ pcs)`
        : `5 business days (auto · ${combinedQty} pcs)`;
}

export function isComboSupported(front, back) {
    if (!front || !back) return true; // single locations always price
    return SUPPORTED_COMBOS.includes(`${front}_${back}`);
}

// Drop a back selection the data can't price with the current front.
// Returns the cleared back code ('' if nothing changed) so callers
// can surface the change to the rep.
export function sanitizeLocationState() {
    if (state.back && !isComboSupported(state.front, state.back)) {
        const cleared = state.back;
        console.warn(`[dtg-inline-form] Unpriceable location combo ${state.front}_${cleared} — back print cleared (no DTG_Costs rows; /api/dtg/quote-pricing rejects it).`);
        state.back = '';
        return cleared;
    }
    return '';
}

// ----- C9 dirty tracking ------------------------------------------------
// Mark the form as having rep-edits since the last chat fill. Used to
// guard against silent overwrite when the chat emits a new PRICE_QUOTE
// while the rep is editing.
// Two dirty flags with different jobs: dirtyAfterChatFill gates the chat
// controller's "overwrite your edits?" warning (cleared on fillFromQuote);
// the shared dtgState.hasChanges (quote-builder-utils.js markAsUnsaved) drives the
// beforeunload leave-guard (cleared only on save/push/reset). Every USER
// mutation site calls markDirty(), so it feeds both; programmatic
// fills/loads call neither. (2026-06-10)
export function markDirty() {
    state.dirtyAfterChatFill = true;
    if (typeof markAsUnsaved === 'function') markAsUnsaved();
}

export function clearDirty() { state.dirtyAfterChatFill = false; }

// ----- C8 bulk size paste -----------------------------------------------
// Parser PROMOTED to quote-builder-utils.js (2026-07-06, UX audit P1 #2)
// so all 4 builders parse "S:2 M:4 L:6" identically — this closure alias
// keeps the C8 paste handler's call site unchanged. Utils loads before
// this file (dtg-quote-builder.html); guard so a load failure degrades to
// "no bulk paste" instead of a ReferenceError killing the handler.
export function parseBulkSizes(text) {
    return (typeof window.parseBulkSizes === 'function') ? window.parseBulkSizes(text) : {};
}

export function showToastSafe(text) {
    const toast = document.getElementById('shareToast');
    const txt = document.getElementById('shareToastText');
    if (!toast || !txt) {
        // Fallback — log
        console.info('[dtg-inline-form]', text);
        return;
    }
    txt.textContent = text;
    toast.classList.add('show');
    clearTimeout(showToastSafe._t);
    showToastSafe._t = setTimeout(() => toast.classList.remove('show'), 2800);
}

/**
 * Position a combobox menu as a fixed-position portal that floats above
 * all stacking contexts. Used by the style + color comboboxes so the
 * dropdown is fully visible regardless of nearby chrome (chat panel,
 * customer pane below the table, live pricing card, etc.).
 *
 * Reads the input's current rect each call so the menu stays pinned
 * during scroll.
 */
export function positionPortaledMenu(menu, input) {
    const rect = input.getBoundingClientRect();
    const vh = window.innerHeight;
    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;
    const maxMenuHeight = 280;
    // Flip to open ABOVE the input when there's more room above than
    // below AND below would be cramped (< 180px).
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    menu.style.position = 'fixed';
    if (openUp) {
        menu.style.top = '';
        menu.style.bottom = (vh - rect.top + 2) + 'px';
        menu.style.maxHeight = Math.min(maxMenuHeight, spaceAbove - 16) + 'px';
    } else {
        menu.style.bottom = '';
        menu.style.top = (rect.bottom + 2) + 'px';
        menu.style.maxHeight = Math.min(maxMenuHeight, spaceBelow - 16) + 'px';
    }
    menu.style.left = rect.left + 'px';
    // Color names like "Athletic Heather" need ~220px to read cleanly;
    // the cell itself is only ~110px wide.
    menu.style.minWidth = Math.max(rect.width, 240) + 'px';
    menu.style.maxWidth = '340px';
}

// ----- Utilities ---------------------------------------------------------
export function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function fmtMoney(n) {
    if (!Number.isFinite(Number(n))) return '0.00';
    return Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
