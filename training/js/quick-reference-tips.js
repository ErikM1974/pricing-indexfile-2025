/* Searchable archive. The shared JSON remains unchanged for its other consumers. */
(() => {
    'use strict';
    const container = document.getElementById('tipsContainer');
    const search = document.getElementById('searchInput');
    const status = document.createElement('p');
    status.className = 'reference-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    search.closest('.search-bar').after(status);
    let tips = [];
    let loaded = false;
    let loading = false;
    const element = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    };
    const localDate = value => new Date(value + 'T12:00:00');
    const isNew = value => {
        const today = new Date();
        const [year, month, day] = value.split('-').map(Number);
        const age = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(year, month - 1, day);
        return age >= 0 && age < 7 * 24 * 60 * 60 * 1000;
    };
    // Keep semantic lesson markup, remove stored presentation rules and executable attributes.
    const lesson = content => {
        const template = document.createElement('template');
        // Repository-owned rich text; sanitize this detached fragment before inserting it.
        // eslint-disable-next-line no-unsanitized/property
        template.innerHTML = content;
        const allowed = new Set(['DIV', 'P', 'SPAN', 'H3', 'H4', 'H5', 'STRONG', 'EM', 'B', 'I', 'UL', 'OL', 'LI', 'BR', 'A', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'CODE']);
        for (const node of [...template.content.querySelectorAll('*')]) {
            if (!allowed.has(node.tagName)) { node.remove(); continue; }
            for (const attribute of [...node.attributes]) {
                if (!['class', 'href', 'target', 'rel', 'colspan', 'rowspan', 'scope'].includes(attribute.name)) node.removeAttribute(attribute.name);
            }
            if (node.tagName === 'A') {
                const url = new window.URL(node.getAttribute('href') || '', window.location.href);
                if (!['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) node.removeAttribute('href');
                if (node.target === '_blank') node.rel = 'noopener noreferrer';
            }
        }
        template.content.querySelectorAll('table').forEach(table => {
            const wrapper = element('div', 'training-table-scroll');
            wrapper.tabIndex = 0;
            wrapper.setAttribute('role', 'region');
            wrapper.setAttribute('aria-label', 'Tip reference table');
            table.before(wrapper); wrapper.append(table);
        });
        return template.content;
    };
    const render = () => {
        if (!loaded) return;
        const term = search.value.trim().toLowerCase();
        const matching = tips.filter(tip => tip.searchText.includes(term));
        container.replaceChildren();
        status.classList.remove('error');
        status.textContent = matching.length ? matching.length + (matching.length === 1 ? ' tip found.' : ' tips found.') : 'No tips found. Try another search.';
        for (const tip of matching) {
            const card = element('article', 'tip-card');
            const header = element('div', 'tip-header');
            const title = element('h2', 'tip-title', tip.title);
            if (isNew(tip.addedDate)) title.append(element('span', 'new-badge', 'New'));
            header.append(title, element('div', 'tip-date', 'Added: ' + localDate(tip.addedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })));
            const body = element('div', 'tip-body');
            body.append(tip.fragment.cloneNode(true));
            card.append(header, body); container.append(card);
        }
    };
    const load = async () => {
        if (loading) return;
        loading = true; loaded = false;
        container.setAttribute('aria-busy', 'true');
        container.replaceChildren();
        status.textContent = 'Loading tips…';
        status.classList.remove('error');
        try {
            const response = await fetch('quick-tips-data.json');
            if (!response.ok) throw new Error('Tips request failed');
            const data = await response.json();
            if (!Array.isArray(data.tips) || data.tips.some(tip => !tip || typeof tip.title !== 'string' || typeof tip.content !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(tip.addedDate) || Number.isNaN(localDate(tip.addedDate).getTime()))) throw new Error('Invalid tips response');
            tips = data.tips.map(tip => {
                const fragment = lesson(tip.content);
                return { ...tip, fragment, searchText: (tip.title + ' ' + fragment.textContent).toLowerCase() };
            });
            document.getElementById('totalTips').textContent = String(tips.length);
            document.getElementById('newTips').textContent = String(tips.filter(tip => isNew(tip.addedDate)).length);
            document.getElementById('categoryCount').textContent = String(new Set(tips.map(tip => tip.category || 'general')).size);
            loaded = true; render();
        } catch {
            status.textContent = 'Unable to load tips. Check your connection and try again.';
            status.classList.add('error');
            for (const id of ['totalTips', 'newTips', 'categoryCount']) document.getElementById(id).textContent = '—';
            const retry = element('button', 'btn', 'Try again');
            retry.type = 'button'; retry.addEventListener('click', load); container.append(retry);
        } finally {
            loading = false;
            container.removeAttribute('aria-busy');
        }
    };
    search.addEventListener('input', render);
    load();
})();
