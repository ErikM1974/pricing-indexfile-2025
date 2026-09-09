/* Historic policy guide: native section links, keyboard navigation and complete printing. */
(function () {
    'use strict';
    const backToTop = document.getElementById('backToTop');
    const contents = document.querySelector('.policy-contents');
    let printedOpen = true;
    contents.open = !window.matchMedia('(max-width: 900px)').matches;
    function syncBackToTop() { backToTop.hidden = window.scrollY <= 100; }
    window.addEventListener('scroll', syncBackToTop, { passive: true });
    backToTop.addEventListener('click', function () {
        const top = document.getElementById('guide-top');
        top.focus({ preventScroll: true });
        top.scrollIntoView({ behavior: 'auto' });
    });
    window.addEventListener('beforeprint', function () { printedOpen = contents.open; contents.open = true; });
    window.addEventListener('afterprint', function () { contents.open = printedOpen; });
    syncBackToTop();
})();
