/* Static brand guides: accessible native navigation and the existing catalogue search. */
(() => {
    'use strict';
    const menu = document.getElementById('sidebar');
    const opener = document.getElementById('mobileMenuBtn');
    const closer = document.getElementById('drawerClose');
    const desktop = window.matchMedia('(min-width: 1051px)');
    if (menu && opener && closer) {
        opener.addEventListener('click', () => {
            if (menu.open) return;
            menu.showModal();
            opener.setAttribute('aria-expanded', 'true');
            document.body.classList.add('drawer-open');
        });
        const close = () => { if (menu.open) menu.close(); };
        closer.addEventListener('click', close);
        menu.addEventListener('keydown', event => {
            if (event.key !== 'Tab') return;
            const controls = [...menu.querySelectorAll('a[href], button:not([disabled])')];
            const first = controls[0], last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault(); last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault(); first.focus();
            }
        });
        menu.addEventListener('click', event => {
            if (event.target !== menu) return;
            const box = menu.getBoundingClientRect();
            if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
        });
        menu.addEventListener('close', () => {
            opener.setAttribute('aria-expanded', 'false');
            document.body.classList.remove('drawer-open');
            if (!desktop.matches) opener.focus();
        });
        desktop.addEventListener('change', event => { if (event.matches) close(); });
        window.addEventListener('pagehide', close);
    }
    const input = document.getElementById('navSearchInput');
    const button = document.getElementById('navSearchBtn');
    const search = () => {
        const term = input ? input.value.trim() : '';
        if (term) window.location.assign('/catalog?q=' + encodeURIComponent(term));
    };
    if (button) button.addEventListener('click', search);
    if (input) input.addEventListener('keydown', event => {
        if (event.key === 'Enter') { event.preventDefault(); search(); }
    });
})();
