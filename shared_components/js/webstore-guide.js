/* Shared public webstore navigation and print state. */
(function () {
    'use strict';
    const disclosures = [...document.querySelectorAll('.faq details')];
    let saved = [];
    window.addEventListener('beforeprint', () => {
        saved = disclosures.map(section => section.open);
        disclosures.forEach(section => { section.open = true; });
    });
    window.addEventListener('afterprint', () => {
        disclosures.forEach((section, i) => { section.open = saved[i]; });
    });
    document.addEventListener('click', event => {
        const link = event.target.closest('a[href^="#"]');
        if (!link) return;
        const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
        if (target) target.focus({ preventScroll: true });
    });
})();
