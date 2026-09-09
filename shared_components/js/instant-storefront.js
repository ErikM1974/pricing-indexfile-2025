/* Shared instant configurator presentation; pricing and submissions stay in their existing controllers. */
(() => {
    'use strict';
    const page = document.querySelector('[data-ui="unified"][data-instant]');
    if (!page) return;
    page.addEventListener('click', (event) => {
        const link = event.target.closest('a[href^="#"]');
        if (!link || link.hash.length < 2) return;
        let id;
        try {
            id = decodeURIComponent(link.hash.slice(1));
        } catch {
            return;
        }
        const target = document.getElementById(id);
        if (target) {
            target.tabIndex = -1;
            target.focus({ preventScroll: true });
        }
    });
    for (const dialog of page.querySelectorAll('dialog')) {
        dialog.addEventListener('keydown', (event) => {
            if (event.key !== 'Tab') return;
            const controls = [
                ...dialog.querySelectorAll(
                    'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary',
                ),
            ].filter((el) => el.tabIndex >= 0 && el.getClientRects().length);
            const first = controls[0],
                last = controls[controls.length - 1];
            if (first && event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (last && !event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        });
    }
    let disclosures = null;
    window.addEventListener('beforeprint', () => {
        if (disclosures) return;
        disclosures = [...page.querySelectorAll('details')].map((node) => ({ node, open: node.open }));
        disclosures.forEach((item) => {
            item.node.open = true;
        });
    });
    window.addEventListener('afterprint', () => {
        disclosures?.forEach((item) => {
            item.node.open = item.open;
        });
        disclosures = null;
    });
})();
