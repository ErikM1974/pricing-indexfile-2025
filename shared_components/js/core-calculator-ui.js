/* Presentation and keyboard access for the five public calculators.
 * Controllers remain the sole owners of prices, quantities and selections. */
(function () {
    'use strict';
    const root = document.querySelector('[data-ui="unified"][data-core-calculator]');
    if (!root) return;
    const toggles = '.toggle-item, .dtf-toggle-item, .sp-toggle-item, .sp-dark-garment-toggle, .sp-safety-stripes-toggle';
    const tiers = '.tier-button, .dtf-tier-button, .sp-tier-button';
    const legacyButtons = toggles + ', .color-swatch, .image-thumbnail, #sp-additional-locations-header';
    const tooltips = {
        'upcharge-info-icon': ['upcharge-tooltip', 'Size pricing'],
        'setup-fee-badge': ['setup-fee-tooltip', 'Art setup fee'],
        'dtf-upcharge-info-icon': ['dtf-upcharge-tooltip', 'Size pricing'],
        'dtf-setup-fee-badge': ['dtf-setup-fee-tooltip', 'Art setup fee'],
        'sp-upcharge-info-icon': ['sp-upcharge-tooltip', 'Size pricing'],
        'sp-setup-fee-badge': ['sp-setup-fee-tooltip', 'Art setup fee'],
        'sp-dark-info-icon': ['sp-dark-tooltip', 'White underbase information']
    };
    function attr(node, key, value) {
        if (node.getAttribute(key) !== String(value)) node.setAttribute(key, String(value));
    }
    let inventoryFocus = null;
    root.addEventListener('focusin', e => {
        inventoryFocus = e.target.matches('.core-table-scroll') && e.target.querySelector('.calc-inv-table')
            ? { node: e.target, left: e.target.scrollLeft } : null;
    });
    root.addEventListener('focusout', e => { if (e.relatedTarget) inventoryFocus = null; });
    root.addEventListener('scroll', e => { if (inventoryFocus?.node === e.target) inventoryFocus.left = e.target.scrollLeft; }, true);
    function searchParts() {
        return { input: root.querySelector('#styleSearch'), panel: root.querySelector('.search-wrapper .search-results:last-child') };
    }
    function syncSearch() {
        const { input, panel } = searchParts();
        if (!input || !panel) return;
        root.querySelectorAll('[id="core-search-results"]').forEach(n => { if (n !== panel) attr(n, 'id', 'searchResults'); });
        attr(panel, 'id', 'core-search-results'); attr(panel, 'role', 'listbox'); attr(panel, 'aria-label', 'Product styles');
        attr(input, 'aria-controls', panel.id); attr(input, 'aria-expanded', panel.classList.contains('active'));
        const selected = input.getAttribute('aria-activedescendant');
        panel.querySelectorAll('.search-result-item').forEach((n, i) => {
            attr(n, 'id', 'core-search-option-' + i); attr(n, 'role', 'option'); attr(n, 'tabindex', '-1');
            attr(n, 'aria-selected', panel.classList.contains('active') && n.id === selected);
        });
        if (!panel.classList.contains('active') || !panel.querySelector('.search-result-item')) input.removeAttribute('aria-activedescendant');
    }
    function sync() {
        syncSearch();
        root.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])').forEach(n => n.classList.add('field-input'));
        root.querySelectorAll('select').forEach(n => n.classList.add('field-select'));
        root.querySelectorAll('button, ' + toggles).forEach(n => { if (!n.matches('.color-swatch')) n.classList.add('btn'); });
        root.querySelectorAll(legacyButtons).forEach(n => {
            if (n.tagName !== 'BUTTON') { attr(n, 'role', 'button'); attr(n, 'tabindex', '0'); }
            if (n.matches(toggles)) attr(n, 'aria-pressed', n.classList.contains('active'));
            if (n.matches('.color-swatch')) {
                const name = n.title || n.querySelector('img')?.alt || 'Product color';
                attr(n, 'aria-label', name);
                attr(n, 'aria-pressed', name === document.getElementById('currentColor')?.textContent.trim());
            }
            if (n.matches('.image-thumbnail')) {
                attr(n, 'aria-label', n.querySelector('img')?.alt || 'Product image');
                attr(n, 'aria-pressed', n.classList.contains('active'));
            }
        });
        root.querySelectorAll(tiers).forEach(n => attr(n, 'aria-pressed', n.classList.contains('selected')));
        for (const [id, [panelId, label]] of Object.entries(tooltips)) {
            const n = document.getElementById(id), panel = document.getElementById(panelId);
            if (!n || !panel) continue;
            n.classList.add('btn', 'core-info-button'); n.removeAttribute('aria-hidden');
            attr(n, 'role', 'button'); attr(n, 'tabindex', '0'); attr(n, 'aria-label', label);
            attr(n, 'aria-controls', panelId); attr(n, 'aria-expanded', getComputedStyle(panel).display !== 'none');
        }
        root.querySelectorAll('table').forEach(table => {
            if (table.parentElement.classList.contains('core-table-scroll')) return;
            const wrap = document.createElement('div'); wrap.className = 'core-table-scroll'; wrap.tabIndex = 0;
            wrap.setAttribute('role', 'region');
            wrap.setAttribute('aria-label', table.classList.contains('calc-inv-table') ? 'Inventory by warehouse and size' : 'Prices by quantity and size');
            table.before(wrap); wrap.append(table);
        });
        const exact = document.getElementById('dtf-exact-quantity');
        if (exact) attr(exact, 'aria-label', 'Exact quantity, 10 to 23 pieces');
        root.querySelectorAll('.sp-location-slot-input-group select').forEach(n => {
            const label = n.parentElement.querySelector('label');
            if (label) attr(n, 'aria-label', label.textContent.trim());
        });
        root.querySelectorAll('.sp-location-slot-remove').forEach(n => attr(n, 'aria-label', 'Remove additional print location'));
        const bar = root.querySelector('[data-calc-inv-toggle]');
        if (bar) attr(bar, 'aria-expanded', !!root.querySelector('.calc-inv-body.show'));
        if (inventoryFocus && !inventoryFocus.node.isConnected && document.activeElement === document.body) {
            const wrap = root.querySelector('.calc-inv-table')?.parentElement;
            if (wrap) { const left = inventoryFocus.left; wrap.focus({ preventScroll: true }); wrap.scrollLeft = left; }
        }
    }
    let queued = false;
    const observer = new MutationObserver(() => {
        if (queued) return;
        queued = true;
        queueMicrotask(() => { queued = false; observer.disconnect(); sync(); observe(); });
    });
    function observe() { observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] }); }
    root.addEventListener('input', e => { if (e.target.id === 'styleSearch') e.target.removeAttribute('aria-activedescendant'); });
    root.addEventListener('keydown', e => {
        const { input, panel } = searchParts();
        // Some existing input listeners close and blur before this event bubbles.
        if (panel && e.key === 'Escape' && e.target.closest('.search-wrapper')) {
            e.preventDefault(); e.stopPropagation(); panel.classList.remove('active'); syncSearch(); input.focus(); return;
        }
        if (panel?.classList.contains('active') && e.target.closest('.search-wrapper')) {
            const options = [...panel.querySelectorAll('.search-result-item')];
            const current = options.findIndex(n => n.id === input.getAttribute('aria-activedescendant'));
            if (e.target === input && options.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                e.preventDefault();
                const index = current < 0 ? (e.key === 'ArrowDown' ? 0 : options.length - 1) : (current + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
                attr(input, 'aria-activedescendant', options[index].id); syncSearch(); options[index].scrollIntoView({ block: 'nearest' }); return;
            }
            if (e.target === input && e.key === 'Enter' && current >= 0) {
                e.preventDefault(); e.stopPropagation(); options[current].click(); return;
            }
        }
        // Native arrow scrolling starts on a later animation frame. Inventory
        // can replace this region before that frame; save the move immediately.
        const region = e.target.matches('.core-table-scroll') ? e.target : null;
        if (region && !e.ctrlKey && !e.metaKey && !e.altKey &&
            (e.key === 'ArrowLeft' || e.key === 'ArrowRight') &&
            region.scrollWidth > region.clientWidth) {
            e.preventDefault();
            region.scrollLeft += e.key === 'ArrowRight' ? 48 : -48;
            if (inventoryFocus?.node === region) inventoryFocus.left = region.scrollLeft;
        }
        const n = e.target.closest('[role="button"]');
        if ((e.key === 'Enter' || e.key === ' ') && n && n.tagName !== 'BUTTON' && !n.matches('[data-calc-inv-toggle]')) { e.preventDefault(); n.click(); }
        if (e.key === 'Escape') for (const [id, [panelId]] of Object.entries(tooltips)) {
            const panel = document.getElementById(panelId);
            if (panel && getComputedStyle(panel).display !== 'none') {
                panel.style.display = 'none'; panel.classList.remove('show'); document.getElementById(id)?.focus(); e.preventDefault();
            }
        }
    });
    // DTF replaces selected controls. Return keyboard focus to the replacement.
    root.addEventListener('click', e => {
        const n = e.target.closest('.dtf-toggle-item, .dtf-tier-button');
        if (!n || document.activeElement !== n) return;
        const key = n.dataset.location ? 'location' : 'tier', value = n.dataset[key];
        // Wait until the entire click dispatch, including controller listeners,
        // has finished; capture-listener microtasks can run before bubbling.
        setTimeout(() => { sync(); if (!n.isConnected) root.querySelector('[data-' + key + '="' + CSS.escape(value) + '"]')?.focus(); }, 0);
    }, true);
    sync(); observe();
}());
