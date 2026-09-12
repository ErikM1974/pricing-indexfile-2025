/* Presentation only: shared controls, keyboard operation and print selection.
 * Pricing and quote handoff remain owned by the existing page controllers. */
(function () {
    'use strict';
    const body = document.body;
    if (!body.hasAttribute('data-quick-quote')) return;
    let scheduled = false;
    let rateCardRequested = false;
    let previousRateCard = null;
    let focusTarget = null;
    const printSummary = document.createElement('p');
    printSummary.className = 'qq-print-summary';
    document.querySelector('.hero').after(printSummary);
    const set = (node, name, value) => {
        if (node.getAttribute(name) !== String(value)) node.setAttribute(name, value);
    };
    const add = (node, ...names) =>
        names.forEach((name) => {
            if (!node.classList.contains(name)) node.classList.add(name);
        });
    function enhance() {
        scheduled = false;
        body.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]), textarea').forEach(
            (node) => add(node, 'field-input')
        );
        body.querySelectorAll('select').forEach((node) => add(node, 'field-select'));
        body.querySelectorAll(
            'button:not(.qq-swatch):not(.qq-example-thumb):not(.ssr-swatch)'
        ).forEach((node) => add(node, 'btn'));
        body.querySelectorAll('.qq-open-builder').forEach((node) =>
            add(node, 'btn', 'btn-primary')
        );
        body.querySelectorAll('.qq-btn-primary, .qq-use-price').forEach((node) =>
            add(node, 'btn-primary')
        );
        body.querySelectorAll('.qq-emb-stitch').forEach((node) =>
            set(node, 'aria-label', 'Stitch count for ' + (node.dataset.logo || 'logo'))
        );
        body.querySelectorAll('.qq-line-style').forEach((node, i) =>
            set(node, 'aria-label', 'Style number ' + (i + 1))
        );
        body.querySelectorAll(
            'button[data-mode], button[data-method], button[data-embtype], .qq-place-chip, .qq-chip, .qq-capemb button'
        ).forEach((node) => {
            set(node, 'aria-pressed', node.classList.contains('is-active'));
        });
        for (const [trigger, panel] of [
            ['qqSizesToggle', 'qqSizes'],
            ['extSizesToggle', 'extSizes'],
        ]) {
            const button = document.getElementById(trigger),
                region = document.getElementById(panel);
            if (button && region) {
                set(button, 'aria-controls', panel);
                set(button, 'aria-expanded', !region.hidden);
            }
        }
        body.querySelectorAll('.qq-matrix-wrap, .qq-sheet-ladder-wrap, .proto-mx-scroll').forEach(
            (node) => {
                set(node, 'tabindex', '0');
                set(node, 'role', 'region');
                set(node, 'aria-label', 'Price breaks, scroll for all quantities');
            }
        );
        body.querySelectorAll('.qq-card.is-clickable[data-method]').forEach((card) => {
            if (!card.querySelector('.qq-show-breaks')) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'btn btn-ghost qq-show-breaks';
                button.dataset.quickQuoteControl = 'breaks';
                button.textContent = 'Show price breaks';
                button.setAttribute(
                    'aria-label',
                    'Show price breaks for ' +
                        card.querySelector('.qq-card-method').textContent.trim()
                );
                card.appendChild(button);
            }
            set(
                card.querySelector('.qq-show-breaks'),
                'aria-pressed',
                card.classList.contains('is-selected')
            );
        });
        body.querySelectorAll('.proto-mx-table tr[data-qty]').forEach((row) => {
            const cell = row.cells[0];
            if (!cell.querySelector('button')) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'btn btn-ghost qq-table-action';
                button.textContent = cell.textContent;
                button.setAttribute('aria-label', 'Use quantity ' + row.dataset.qty);
                cell.replaceChildren(button);
            }
            set(cell.querySelector('button'), 'aria-pressed', row.classList.contains('is-current'));
        });
        const warning = document.getElementById('pricing-api-warning');
        if (warning && !warning.classList.contains('qq-critical-error')) {
            // Adapt this page's copy of the legacy warning; retain its message and actions.
            warning.removeAttribute('style');
            warning.querySelectorAll('[style]').forEach((node) => node.removeAttribute('style'));
            warning.classList.remove('api-warning-banner');
            add(warning, 'qq-critical-error');
            set(warning, 'role', 'alert');
            document.querySelector('.hero').after(warning);
        }
        if (focusTarget && !focusTarget.node.isConnected && document.activeElement === body) {
            const target = document.querySelector(focusTarget.selector);
            if (target) target.focus({ preventScroll: true });
        }
        focusTarget = null;
    }
    function schedule() {
        if (!scheduled) {
            scheduled = true;
            requestAnimationFrame(enhance);
        }
    }
    body.addEventListener(
        'click',
        (event) => {
            const button = event.target.closest('button');
            if (!button) return;
            if (button.id === 'rateCardBtn') {
                rateCardRequested = true;
                previousRateCard = document.getElementById('rateCardSheet')?.firstElementChild;
            }
            if (button.classList.contains('qq-show-breaks')) {
                focusTarget = {
                    node: button,
                    selector:
                        '.qq-card[data-method="' +
                        CSS.escape(button.closest('[data-method]').dataset.method) +
                        '"] .qq-show-breaks',
                };
            } else if (button.closest('.proto-mx-table')) {
                focusTarget = {
                    node: button,
                    selector:
                        '.proto-mx-table tr[data-qty="' +
                        CSS.escape(button.closest('[data-qty]').dataset.qty) +
                        '"] button',
                };
            }
            schedule();
        },
        true
    );
    body.addEventListener('input', schedule);
    body.addEventListener('change', schedule);
    const observer = new MutationObserver(schedule);
    observer.observe(body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'hidden'],
    });
    window.addEventListener('beforeprint', () => {
        const sheet = document.getElementById('rateCardSheet');
        // A failed rebuild must never print the previous product's rate card.
        body.classList.toggle(
            'qq-print-ratecard',
            !!(
                rateCardRequested &&
                sheet?.firstElementChild &&
                sheet.firstElementChild !== previousRateCard
            )
        );
        const value = (id) => document.getElementById(id)?.value || '';
        const color =
            document.getElementById('qqColorSelected')?.textContent ||
            document.getElementById('color')?.selectedOptions[0]?.textContent ||
            '';
        printSummary.textContent = [
            'Northwest Custom Apparel',
            value('qqStyle') || value('style'),
            color,
            (value('qqQty') || value('qty')) + ' pieces',
            document.getElementById('qqStyleStatus')?.textContent,
            document.querySelector('.qq-inv-error')?.firstChild?.textContent,
        ]
            .filter(Boolean)
            .join(' · ');
    });
    window.addEventListener('afterprint', () => {
        body.classList.remove('qq-print-ratecard');
        rateCardRequested = false;
    });
    enhance();
})();
