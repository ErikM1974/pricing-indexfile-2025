/* Shared reference guide controls. Existing checklist keys remain unchanged. */
(() => {
    'use strict';
    const root = document.querySelector('[data-ui="unified"][data-training="reference"]');
    if (!root) return;
    const motion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
    root.querySelectorAll('[data-action="print"]').forEach(button => button.addEventListener('click', () => window.print()));
    const topButton = root.querySelector('[data-action="top"]');
    if (topButton) {
        topButton.addEventListener('click', () => {
            const heading = root.querySelector('h1');
            heading.tabIndex = -1;
            heading.focus({ preventScroll: true });
            window.scrollTo({ top: 0, behavior: motion() });
        });
        const updateTop = () => topButton.classList.toggle('visible', window.scrollY > 600);
        window.addEventListener('scroll', updateTop, { passive: true });
        updateTop();
    }
    root.querySelectorAll('.quicknav a[href^="#"], a[href^="#sizes"]').forEach(link => {
        link.addEventListener('click', event => {
            const target = document.getElementById(link.hash.slice(1));
            if (!target) return;
            event.preventDefault();
            target.tabIndex = -1;
            target.focus({ preventScroll: true });
            target.scrollIntoView({ behavior: motion(), block: 'start' });
            window.history.replaceState(null, '', link.hash);
        });
    });
    const prefix = root.dataset.checklistPrefix;
    if (!prefix) return;
    const checklists = new Map();
    root.querySelectorAll('[data-checklist]').forEach(grid => {
        const name = grid.dataset.checklist;
        const boxes = [...grid.querySelectorAll('input[type="checkbox"]')];
        const status = document.createElement('p');
        status.className = 'reference-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        grid.after(status);
        const announce = (text, error = false) => {
            status.textContent = text;
            status.classList.toggle('error', error);
        };
        let canSave = true;
        try {
            const saved = window.localStorage.getItem(prefix + name);
            if (saved !== null) {
                const values = saved.split(',');
                if (values.length !== boxes.length || values.some(value => !['0', '1'].includes(value))) {
                    canSave = false;
                    throw new Error('Stored checklist is not valid');
                }
                boxes.forEach((box, index) => { box.checked = values[index] === '1'; });
            }
        } catch {
            canSave = false;
            announce('Checklist progress could not be loaded. You can use it for this visit; saved progress was left unchanged. Reload to try again.', true);
        }
        const save = () => {
            if (!canSave) {
                announce('This change is only for this visit. Saved progress could not be read and was left unchanged. Reload to try again.', true);
                return;
            }
            try {
                window.localStorage.setItem(prefix + name, boxes.map(box => box.checked ? '1' : '0').join(','));
                announce('Progress saved in this browser.');
            } catch {
                announce('Progress could not be saved. This change is only for this visit. Check browser storage and try again.', true);
            }
        };
        boxes.forEach(box => box.addEventListener('change', save));
        checklists.set(name, { reset: () => {
            boxes.forEach(box => { box.checked = false; });
            if (!canSave) { save(); return; }
            try {
                window.localStorage.removeItem(prefix + name);
                announce('Checklist reset in this browser.');
            } catch {
                announce('The saved checklist could not be reset. This reset is only for this visit. Check browser storage and try again.', true);
            }
        } });
    });
    root.querySelectorAll('[data-reset]').forEach(button => button.addEventListener('click', () => {
        button.dataset.reset.split(/\s+/).forEach(name => checklists.get(name)?.reset());
    }));
})();
