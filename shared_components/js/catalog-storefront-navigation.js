/* Home/catalog/product navigation uses native focus containment; legacy show hooks remain compatible. */
(() => {
    'use strict';
    const menu = document.getElementById('sidebar');
    const opener = document.getElementById('mobileMenuBtn');
    const closer = document.getElementById('drawerClose');
    const browse = document.getElementById('allCategoriesTile');
    if (!(menu instanceof HTMLDialogElement) || !opener || !closer) return;
    let trigger = opener;
    const close = () => {
        menu.classList.remove('show');
        document.getElementById('sidebarOverlay')?.classList.remove('show');
        if (menu.open) menu.close();
    };
    const sync = () => {
        const visible = menu.classList.contains('show');
        if (visible && !menu.open) {
            menu.showModal();
            closer.focus();
        } else if (!visible && menu.open) menu.close();
        opener.setAttribute('aria-expanded', String(visible));
        document.body.classList.toggle('drawer-open', visible);
    };
    for (const button of [opener, browse].filter(Boolean)) {
        button.addEventListener('click', event => {
            event.preventDefault();
            trigger = button;
            menu.classList.add('show');
            sync();
        });
    }
    closer.addEventListener('click', close);
    menu.addEventListener('cancel', event => { event.preventDefault(); close(); });
    menu.addEventListener('close', () => {
        menu.classList.remove('show');
        opener.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('drawer-open');
        if (trigger.isConnected && trigger.getClientRects().length) trigger.focus();
    });
    menu.addEventListener('click', event => {
        if (event.target !== menu) return;
        const box = menu.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
    });
    menu.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return;
        const controls = [...menu.querySelectorAll('a[href],button:not([disabled]),input:not([disabled])')]
            .filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    new MutationObserver(sync).observe(menu, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('pagehide', close);
    opener.setAttribute('aria-expanded', 'false');

    // Keep the existing generated subcategory links inside the modal focus tree.
    const placeFlyout = event => {
        const item = event.target.closest('.category-item');
        const flyout = document.getElementById('categoryFlyout');
        if (!item || !flyout || flyout.contains(event.target)) return;
        item.appendChild(flyout);
        if (event.type === 'focusin') item.dispatchEvent(new MouseEvent('mouseenter'));
    };
    menu.addEventListener('mouseover', placeFlyout);
    menu.addEventListener('focusin', placeFlyout);

    // The filter rail stays in the same DOM position on desktop and mobile.
    // Its existing search controller owns the show state; this owns focus only.
    const rail = document.getElementById('filtersRail');
    if (!rail) return;
    const mobile = window.matchMedia('(max-width: 960px)');
    const filterOpener = document.getElementById('filtersOpen');
    const filterCloser = document.getElementById('filtersClose');
    let filtersOpen = false;
    let background = [];
    const syncFilters = () => {
        const active = mobile.matches && rail.classList.contains('show');
        rail.inert = mobile.matches && !active;
        rail.tabIndex = mobile.matches ? -1 : 0;
        if (active && !filtersOpen) {
            rail.setAttribute('role', 'dialog');
            rail.setAttribute('aria-modal', 'true');
            for (let node = rail; node.parentElement; node = node.parentElement) {
                for (const sibling of node.parentElement.children) {
                    if (sibling === node || sibling.matches('.filters-overlay,script,link')) continue;
                    background.push({ node: sibling, inert: sibling.inert });
                    sibling.inert = true;
                }
                if (node.parentElement === document.body) break;
            }
            filterCloser.focus();
        } else if (!active && filtersOpen) {
            rail.removeAttribute('role');
            rail.removeAttribute('aria-modal');
            for (const item of background) item.node.inert = item.inert;
            background = [];
            if (mobile.matches) filterOpener.focus();
        }
        filtersOpen = active;
    };
    document.addEventListener('keydown', event => {
        if (!filtersOpen || event.key !== 'Tab') return;
        const controls = [...rail.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled])')]
            .filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
        const first = controls[0], last = controls[controls.length - 1];
        if (!rail.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
        else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    new MutationObserver(syncFilters).observe(rail, { attributes: true, attributeFilter: ['class'] });
    mobile.addEventListener('change', syncFilters);
    syncFilters();
})();
