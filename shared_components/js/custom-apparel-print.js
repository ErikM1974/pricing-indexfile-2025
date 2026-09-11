/* Printed order details share the values of the existing form; no order data is sent. */
(function () {
    'use strict';
    let footerMarker = null;
    let printFooter = null;
    function clearPrintValues() {
        document.querySelectorAll('.apparel-print-value').forEach(node => node.remove());
        document.querySelectorAll('.apparel-print-source').forEach(node => node.classList.remove('apparel-print-source'));
        if (footerMarker && printFooter) footerMarker.replaceWith(printFooter);
        footerMarker = null;
        printFooter = null;
    }
    window.addEventListener('beforeprint', () => {
        clearPrintValues();
        const header = document.querySelector('.site-head');
        const footer = document.querySelector('.site-foot');
        // Keep contact details with the printed letterhead, regardless of note length.
        if (header && footer) {
            footerMarker = document.createComment('apparel footer position');
            printFooter = footer;
            footer.before(footerMarker);
            header.after(footer);
        }
        document.querySelectorAll('.form-field input, .form-field textarea').forEach(field => {
            if (!field.getClientRects().length || ['checkbox', 'radio', 'file', 'hidden'].includes(field.type)) return;
            const value = document.createElement('span');
            value.className = 'apparel-print-value';
            value.textContent = field.value || '—';
            field.classList.add('apparel-print-source');
            field.after(value);
        });
    });
    window.addEventListener('afterprint', clearPrintValues);
})();
