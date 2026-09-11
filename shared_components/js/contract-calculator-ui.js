/* Shared contract-calculator presentation. Existing controllers own all prices and requests. */
(function () {
    'use strict';
    const root = document.querySelector('[data-ui="unified"][data-contract-calculator]');
    if (!root) return;
    const panel = root.querySelector('#aiChatPanel');
    let wasOpen = false, opener = null;
    const inertBefore = new Map();
    function attr(node, key, value) {
        if (node.getAttribute(key) !== String(value)) node.setAttribute(key, String(value));
    }
    function syncPanel() {
        if (!panel) return;
        const open = panel.classList.contains('is-open');
        attr(panel, 'role', 'dialog'); attr(panel, 'aria-modal', 'true');
        panel.inert = !open;
        const trigger = root.querySelector('#aiDraftBtn');
        if (trigger) { attr(trigger, 'aria-expanded', open); attr(trigger, 'aria-controls', panel.id); }
        if (open && !wasOpen) {
            for (const node of root.children) if (node !== panel && !node.matches('script, style, link')) {
                inertBefore.set(node, node.inert); node.inert = true;
            }
            if (!panel.contains(document.activeElement)) panel.querySelector('#aiChatTextarea')?.focus();
        } else if (!open && wasOpen) {
            for (const [node, inert] of inertBefore) node.inert = inert;
            inertBefore.clear();
            if (opener?.isConnected) opener.focus();
        }
        wasOpen = open;
    }
    function sync() {
        root.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="file"])').forEach(n => n.classList.add('field-input'));
        root.querySelectorAll('textarea').forEach(n => n.classList.add('field-textarea'));
        root.querySelectorAll('select').forEach(n => n.classList.add('field-select'));
        root.querySelectorAll('button, a.btn').forEach(n => {
            n.classList.add('btn');
            if (n.matches('.primary, .ai-chat-send, .print-btn')) n.classList.add('btn-primary');
        });
        root.querySelectorAll('table').forEach(table => {
            if (table.parentElement.classList.contains('contract-table-scroll')) return;
            const wrapper = document.createElement('div'); wrapper.className = 'contract-table-scroll'; wrapper.tabIndex = 0;
            attr(wrapper, 'role', 'region');
            attr(wrapper, 'aria-label', table.closest('.table-section')?.querySelector('h3')?.textContent.trim() || 'Contract prices by quantity');
            table.before(wrapper); wrapper.append(table);
        });
        root.querySelectorAll('.seg, .tabs').forEach(group => {
            attr(group, 'role', 'group');
            if (!group.hasAttribute('aria-labelledby')) attr(group, 'aria-label', 'Pricing table product');
            group.querySelectorAll('button').forEach(n => {
                n.removeAttribute('role'); n.removeAttribute('aria-selected');
                attr(n, 'aria-pressed', n.classList.contains('active'));
            });
        });
        syncPanel();
    }
    const observer = new MutationObserver(() => { observer.disconnect(); sync(); observe(); });
    function observe() { observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-hidden'] }); }
    root.addEventListener('click', e => { if (e.target.closest('#aiDraftBtn')) opener = e.target.closest('#aiDraftBtn'); }, true);
    root.addEventListener('keydown', e => {
        if (panel?.classList.contains('is-open')) {
            if (e.key === 'Escape') { e.preventDefault(); panel.querySelector('#aiChatClose')?.click(); return; }
            if (e.key === 'Tab') {
                const items = [...panel.querySelectorAll('button, a[href], textarea, input, select, [tabindex="0"]')].filter(n => !n.disabled && n.getClientRects().length);
                const first = items[0], last = items.at(-1);
                if (items.length && (e.shiftKey ? document.activeElement === first : document.activeElement === last)) {
                    e.preventDefault(); (e.shiftKey ? last : first).focus();
                }
            }
        }
        const group = e.target.closest('.seg, .tabs');
        if (group && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
            const buttons = [...group.querySelectorAll('button')], current = buttons.indexOf(e.target);
            if (current < 0) return;
            e.preventDefault();
            const i = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (current + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
            buttons[i].focus(); buttons[i].click();
        }
    });
    sync(); observe();
}());
