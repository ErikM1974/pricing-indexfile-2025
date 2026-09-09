/* Shared campaign page navigation and reversible paper preparation. No business requests. */
(() => {
    'use strict';
    function init() {
        const page = document.querySelector('[data-ui="unified"][data-campaign]');
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
            if (!target) return;
            target.tabIndex = -1;
            target.focus({ preventScroll: true });
        });
        const dialog = page.querySelector('dialog[data-lightbox]');
        if (dialog) {
            const triggers = [...page.querySelectorAll('.team__card .team__card-image')];
            const img = dialog.querySelector('.lightbox__image');
            const caption = dialog.querySelector('.lightbox__caption');
            let index = 0,
                origin = null;
            function show(next) {
                index = (next + triggers.length) % triggers.length;
                const source = triggers[index].querySelector('img');
                img.src = source.currentSrc || source.src;
                img.alt = source.alt;
                caption.textContent =
                    triggers[index].closest('figure').querySelector('figcaption')?.textContent.trim() || '';
            }
            for (const [i, trigger] of triggers.entries()) {
                trigger.setAttribute('role', 'button');
                trigger.tabIndex = 0;
                trigger.setAttribute('aria-label', 'View larger photo');
                const open = () => {
                    origin = trigger;
                    show(i);
                    dialog.showModal();
                    dialog.querySelector('.lightbox__close').focus();
                };
                trigger.addEventListener('click', open);
                trigger.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        open();
                    }
                });
            }
            dialog.querySelector('.lightbox__close').addEventListener('click', () => dialog.close());
            dialog.querySelector('.lightbox__prev').addEventListener('click', () => show(index - 1));
            dialog.querySelector('.lightbox__next').addEventListener('click', () => show(index + 1));
            dialog.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    const controls = [...dialog.querySelectorAll('button:not(:disabled)')];
                    const first = controls[0],
                        last = controls[controls.length - 1];
                    if (e.shiftKey && document.activeElement === first) {
                        e.preventDefault();
                        last.focus();
                    } else if (!e.shiftKey && document.activeElement === last) {
                        e.preventDefault();
                        first.focus();
                    }
                }
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    show(index + (e.key === 'ArrowLeft' ? -1 : 1));
                }
            });
            dialog.addEventListener('click', (e) => {
                if (e.target !== dialog) return;
                const r = dialog.getBoundingClientRect();
                if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
                    dialog.close();
            });
            dialog.addEventListener('close', () => {
                img.removeAttribute('src');
                origin?.focus();
            });
        }
        let disclosures = null;
        function prepare() {
            if (disclosures) return;
            disclosures = [...page.querySelectorAll('details')].map((node) => ({ node, open: node.open }));
            disclosures.forEach((item) => {
                item.node.open = true;
            });
        }
        function restore() {
            if (!disclosures) return;
            disclosures.forEach((item) => {
                item.node.open = item.open;
            });
            disclosures = null;
        }
        window.addEventListener('beforeprint', prepare);
        window.addEventListener('afterprint', restore);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
