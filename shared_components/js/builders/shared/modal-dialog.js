/**
 * Native modal dialogs for the quote builders (2026-09-17). NWCA-2026-GUIDE: use
 * dialog.showModal()/close() and give focus back to the opener.
 *
 * The <dialog> is the dimmed full-screen layer: give it the page's overlay class plus
 * `qb-overlay-dialog` (quote-workspace.css fills the viewport with it and hides it once
 * closed) and put the panel inside. showModal() makes the builder behind it inert; this
 * module adds what the browser leaves out:
 *   - Tab wraps inside the newest open dialog (Chrome's native modal otherwise lets it
 *     leave for the browser toolbar);
 *   - Escape and a click on the dimmed layer are handled here, once, so page-level Escape
 *     handlers (assistant panel, extended-size popup) don't also fire;
 *   - closing gives focus back to the element that opened the dialog.
 *
 * Used by the DTG push/assistant confirms (dtg/output.js) and the embroidery goods,
 * names and manual-item dialogs (emb/product-rows.js).
 */

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const openDialogs = [];

/**
 * Shows `dialog` (a filled <dialog> not yet in the document) as a modal and focuses
 * `initialFocus` (default: its first focusable element). Escape, a click on the dimmed
 * layer and any other close request call `onDismiss` (default: close).
 *
 * Returns close(...focusTargets): removes the dialog and focuses the first of
 * `focusTargets`, then the opener, that actually takes focus (still in the document,
 * visible and enabled). Later calls do nothing.
 *
 * @param {HTMLDialogElement} dialog
 * @param {{ initialFocus?: HTMLElement|null, onDismiss?: () => void }} [options]
 * @returns {(...focusTargets: (HTMLElement|null)[]) => void}
 */
export function showModalDialog(dialog, { initialFocus = null, onDismiss } = {}) {
    const opener = /** @type {HTMLElement|null} */ (document.activeElement);
    const focusables = () => /** @type {HTMLElement[]} */ (Array.from(dialog.querySelectorAll(FOCUSABLE)));
    let isOpen = true;

    function release() {
        isOpen = false;
        openDialogs.splice(openDialogs.indexOf(dialog), 1);
        document.removeEventListener('keydown', onKey, true);
    }
    function close(...focusTargets) {
        if (!isOpen) return;
        release();
        if (dialog.open) dialog.close();
        dialog.remove();
        for (const target of [...focusTargets, opener]) {
            if (!target || target === document.body || !target.isConnected) continue;
            // A named target may be out of view (a cell in a scrolled table), so it scrolls in;
            // the opener is where the rep just was.
            target.focus(target === opener ? { preventScroll: true } : undefined);
            if (document.activeElement === target) return;
        }
    }
    const dismiss = () => (onDismiss ? onDismiss() : close());

    function onKey(e) {
        // A dialog removed from the page without close() (a caller replacing it) stops listening.
        if (!dialog.isConnected) { release(); return; }
        if (openDialogs[openDialogs.length - 1] !== dialog) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            dismiss();
        } else if (e.key === 'Tab') {
            const stops = focusables();
            const first = stops[0];
            const last = stops[stops.length - 1];
            if (!dialog.contains(document.activeElement) || document.activeElement === (e.shiftKey ? first : last)) {
                e.preventDefault();
                (e.shiftKey ? last : first).focus();
            }
        }
    }

    dialog.addEventListener('click', (e) => { if (e.target === dialog) dismiss(); });
    dialog.addEventListener('close', () => { if (isOpen) dismiss(); });
    document.addEventListener('keydown', onKey, true);
    openDialogs.push(dialog);
    document.body.appendChild(dialog);
    dialog.showModal();
    (initialFocus || focusables()[0])?.focus();
    return close;
}
