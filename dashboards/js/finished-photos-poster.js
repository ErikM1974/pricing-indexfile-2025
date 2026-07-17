/* Finished Photos wall poster — the Print button (external JS per the no-inline-code rule). */
(function () {
    'use strict';
    var btn = document.getElementById('fpp-print');
    if (btn) btn.addEventListener('click', function () { window.print(); });
})();
