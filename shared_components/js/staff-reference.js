/* Staff reference print disclosure state and native fragment focus. */
(() => {
    'use strict';
    const contents = document.querySelector('details.seo-toc');
    if (contents) {
        const wide = window.matchMedia('(min-width: 901px)');
        contents.open = wide.matches;
        wide.addEventListener('change', event => { contents.open = event.matches; });
    }
    const items = [...document.querySelectorAll('.accordion-item')];
    let saved = [];
    const set = (item, open) => {
        item.classList.toggle('open', open);
        const header = item.querySelector('.accordion-header');
        if (header) header.setAttribute('aria-expanded', String(open));
    };
    window.addEventListener('beforeprint', () => {
        saved = items.map(item => item.classList.contains('open'));
        items.forEach(item => set(item, true));
    });
    window.addEventListener('afterprint', () => items.forEach((item, index) => set(item, saved[index])));
    document.addEventListener('click', event => {
        const link = event.target.closest('a[href^="#"]');
        if (!link) return;
        const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
        if (target) target.focus({ preventScroll: true });
    });
})();
