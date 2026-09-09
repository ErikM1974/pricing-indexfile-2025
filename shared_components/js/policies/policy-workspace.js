/* Shared presentation for the four policy pages. Policy data and editor state keep their own owners. */
(function () {
    'use strict';
    const contents = Array.from(document.querySelectorAll('.policy-navigation'));
    const phone = window.matchMedia('(max-width: 900px)');
    contents.forEach(section => { section.open = !phone.matches; });
    phone.addEventListener('change', () => { contents.forEach(section => { section.open = !phone.matches; }); });
    let beforePrint = [];
    window.addEventListener('beforeprint', () => { beforePrint = contents.map(section => section.open); contents.forEach(section => { section.open = true; }); });
    window.addEventListener('afterprint', () => { contents.forEach((section, i) => { section.open = beforePrint[i]; }); });
    function enhance(root) {
        if (!(root instanceof Element)) return;
        const nodes = selector => [...(root.matches(selector) ? [root] : []), ...root.querySelectorAll(selector)];
        nodes('button').forEach(button => {
            if (button.closest('.tt-toolbar, .tt-content, .ProseMirror')) return;
            button.classList.add('btn');
            if (!button.hasAttribute('type')) button.type = 'button';
        });
        nodes('input:not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea').forEach(field => {
            if (field.closest('.tt-content, .ProseMirror')) return;
            field.classList.add(field.tagName === 'TEXTAREA' ? 'field-textarea' : 'field-input');
        });
        nodes('.policy-body table, .handbook-chapter-body table, .handbook-intro table').forEach(table => {
            if (table.closest('.tt-content, .ProseMirror, .policy-table-scroll')) return;
            const wrap = document.createElement('div'); wrap.className = 'policy-table-scroll';
            wrap.tabIndex = 0; wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', 'Policy table; scroll horizontally');
            table.before(wrap); wrap.append(table);
        });
        nodes('.policy-body :is(h1,h2,h3)[id], .handbook-chapter[id], .handbook-intro[id]').forEach(section => { section.tabIndex = -1; });
    }
    enhance(document.body);
    // Renderers replace panels after reads. Enhance only added elements, avoiding editor-owned content.
    new MutationObserver(records => { for (const record of records) for (const node of record.addedNodes) enhance(node); }).observe(document.body, { childList: true, subtree: true });
})();
