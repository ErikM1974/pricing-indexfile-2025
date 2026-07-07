/**
 * quote-launcher.js — the dashboard's ONE door into quoting (2026-07-07,
 * guided-quote entry). Wires the Quoting card's big "New Quote" button to the
 * #quote-launcher dialog (one question: what are we decorating?), and shows a
 * "Continue in <method> →" chip that remembers each rep's last-used builder
 * (AEs quote in streaks — localStorage nwca-last-quote-method).
 *
 * Pure UI routing: no pricing, no API calls. Defensive: no-ops if the card or
 * dialog markup is absent.
 */
(function () {
    'use strict';

    const LAST_KEY = 'nwca-last-quote-method';

    const startBtn = document.getElementById('quote-start-btn');
    const dialog = document.getElementById('quote-launcher');
    const backdrop = document.getElementById('quote-launcher-backdrop');
    const closeBtn = document.getElementById('quote-launcher-close');
    if (!startBtn || !dialog || !backdrop || !closeBtn) return;

    let lastFocus = null;

    function open() {
        lastFocus = document.activeElement;
        dialog.hidden = false;
        backdrop.hidden = false;
        const first = dialog.querySelector('.ql-chip');
        if (first) first.focus();
    }

    function close() {
        dialog.hidden = true;
        backdrop.hidden = true;
        if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    }

    startBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !dialog.hidden) close();
    });

    // Remember the picked method so next visit offers "Continue in X →"
    dialog.addEventListener('click', (e) => {
        const chip = e.target.closest('.ql-chip');
        if (!chip) return;
        try {
            localStorage.setItem(LAST_KEY, JSON.stringify({
                label: chip.dataset.label || chip.querySelector('.ql-name')?.textContent || 'last builder',
                href: chip.getAttribute('href')
            }));
        } catch (_) { }
        // let the anchor navigate normally
    });

    // Continue chip — only when a remembered method exists and its href is one
    // of the launcher's own targets (never trust a stale/foreign URL).
    (function initContinueChip() {
        const chip = document.getElementById('quote-continue-chip');
        const label = document.getElementById('quote-continue-label');
        if (!chip || !label) return;
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem(LAST_KEY) || 'null'); } catch (_) { }
        if (!saved || !saved.href) return;
        const known = Array.from(dialog.querySelectorAll('.ql-chip')).some(a => a.getAttribute('href') === saved.href);
        if (!known) return;
        chip.href = saved.href;
        label.textContent = 'Continue in ' + saved.label + ' →';
        chip.hidden = false;
    })();
})();
