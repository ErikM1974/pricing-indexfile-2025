/* Presentation only: canonical controls, scroll regions, dialog focus and paper. */
(function () {
    'use strict';
    const root = document.querySelector('[data-ui="unified"][data-specialty-calculator]');
    if (!root) return;
    const panel = root.querySelector('#aiChatPanel');
    const printDetails = new Map();
    function sync() {
        root.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="file"])').forEach(node => node.classList.add('field-input'));
        root.querySelectorAll('select').forEach(node => node.classList.add('field-select'));
        root.querySelectorAll('textarea').forEach(node => node.classList.add('field-textarea'));
        root.querySelectorAll('button').forEach(node => {
            node.classList.add('btn');
            if (node.matches('.primary, .ai-open-btn, .floating-quote-btn, .ai-chat-send')) node.classList.add('btn-primary');
        });
        root.querySelectorAll('table').forEach(table => {
            if (table.parentElement.classList.contains('specialty-table-scroll')) return;
            const wrapper = document.createElement('div');
            wrapper.className = 'specialty-table-scroll';
            wrapper.tabIndex = 0;
            wrapper.setAttribute('role', 'region');
            wrapper.setAttribute('aria-label', table.classList.contains('emblem-pricing-table') ? 'Emblem prices by size and quantity' : table.classList.contains('decal-cheat') ? 'Decal area by size' : 'Decal rates by total area');
            table.before(wrapper); wrapper.append(table);
        });
        if (root.dataset.specialtyCalculator === 'richardson') {
            for (const id of ['styleAutocomplete', 'pricePlaceholder', 'priceBreakdown', 'ltmNotice', 'setupNotice', 'clearCapSearch', 'noResultsMessage']) {
                const node = root.querySelector('#' + id);
                if (node) node.hidden = node.classList.contains('hidden');
            }
        }
        if (panel) {
            const open = panel.classList.contains('open');
            panel.inert = !open;
            root.querySelectorAll('#aiOpenBtn, #floatingQuoteBtn').forEach(node => {
                node.setAttribute('aria-expanded', String(open));
                node.setAttribute('aria-controls', panel.id);
            });
        }
    }
    const observer = new MutationObserver(() => { observer.disconnect(); sync(); observe(); });
    function observe() {
        observer.observe(root, {subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-hidden']});
    }
    root.addEventListener('keydown', event => {
        if (event.key !== 'Tab' || !panel?.classList.contains('open')) return;
        const items = [...panel.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]')].filter(node => !node.disabled && !node.closest('[hidden]') && node.getClientRects().length);
        const first = items[0], last = items.at(-1);
        if (items.length && (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
            event.preventDefault(); (event.shiftKey ? last : first).focus();
        }
    });
    window.addEventListener('beforeprint', () => {
        root.querySelectorAll('details').forEach(node => {
            if (!printDetails.has(node)) printDetails.set(node, node.open);
            node.open = true;
        });
    });
    window.addEventListener('afterprint', () => {
        for (const [node, open] of printDetails) node.open = open;
        printDetails.clear();
    });
    sync(); observe();
}());
