/* Presentation only: keyboard access, native dialog behavior and print restoration. */
(function () {
    'use strict';
    const body = document.body;
    if (!body.hasAttribute('data-embroidery-reference')) return;
    const dialog = document.getElementById('scModal');
    const set = (node, name, value) => { if (node.getAttribute(name) !== value) node.setAttribute(name, value); };
    let printState;

    function enhance() {
        document.querySelectorAll('.tab-btn, .sc-filter-btn').forEach(button => {
            set(button, 'aria-pressed', String(button.classList.contains('active')));
        });
        document.querySelectorAll('.es-account-card').forEach((card, i) => {
            const header = card.querySelector('.es-account-hdr'), content = card.querySelector('.es-design-wrap');
            if (!header || !content) return;
            set(header, 'role', 'button'); set(header, 'tabindex', '0');
            set(content, 'id', 'embroidery-account-' + i);
            set(header, 'aria-controls', content.id);
            set(header, 'aria-expanded', String(card.classList.contains('open')));
        });
        document.querySelectorAll('.sc-sortable').forEach(th => {
            if (th.querySelector('button')) return;
            const button = document.createElement('button'); button.type = 'button';
            button.className = 'embroidery-sort-button';
            while (th.firstChild) button.append(th.firstChild);
            th.append(button);
        });
        document.querySelectorAll('.pricing-matrix, .es-fb-table').forEach(table => {
            if (table.parentElement.classList.contains('embroidery-table-scroll')) return;
            const wrap = document.createElement('div'); wrap.className = 'embroidery-table-scroll';
            table.before(wrap); wrap.append(table);
        });
        document.querySelectorAll('.embroidery-table-scroll, .es-design-wrap, .sc-modal-body').forEach(wrap => {
            set(wrap, 'tabindex', '0'); set(wrap, 'role', 'region');
            set(wrap, 'aria-label', wrap.classList.contains('sc-modal-body') ? 'Surcharge account results' : 'Pricing table; scroll for all columns');
        });
    }
    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.querySelector('main'), {childList: true, subtree: true});
    document.addEventListener('click', () => { requestAnimationFrame(enhance); });
    document.addEventListener('keydown', event => {
        if (dialog.open && event.key === 'Tab') {
            const controls = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')]
                .filter(node => node.getClientRects().length);
            const first = controls[0], last = controls[controls.length - 1];
            if (event.shiftKey && event.target === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && event.target === last) { event.preventDefault(); first.focus(); }
        }
        if (event.target.matches('.es-account-hdr') && ['Enter', ' '].includes(event.key)) {
            event.preventDefault(); event.target.click();
        }
    });
    dialog.addEventListener('cancel', event => { event.preventDefault(); window.closeSurchargeModal(); });

    window.addEventListener('beforeprint', () => {
        if (printState) return;
        printState = {details: [], accounts: [], modal: dialog.open};
        if (dialog.open) { body.dataset.printMode = 'accounts'; dialog.close(); }
        document.querySelectorAll('.tab-content.active details:not([open])').forEach(detail => {
            printState.details.push(detail); detail.open = true;
        });
        document.querySelectorAll('.tab-content.active .es-account-card:not(.open)').forEach(card => {
            printState.accounts.push(card); card.classList.add('open');
        });
        enhance();
    });
    window.addEventListener('afterprint', () => {
        if (!printState) return;
        const state = printState; printState = undefined;
        state.details.forEach(detail => { detail.open = false; });
        state.accounts.forEach(card => { card.classList.remove('open'); });
        delete body.dataset.printMode;
        if (state.modal) dialog.showModal();
        enhance();
    });
})();
