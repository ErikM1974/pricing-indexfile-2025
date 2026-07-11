/**
 * sample-checkout-form.js — pages/forms/sample-checkout-form.html
 *
 * Fill-in-the-browser twin of /forms/sample-checkout-return-agreement.pdf.
 * Nothing is saved anywhere — print / Save as PDF is the output. Never type
 * a full card number on this form (last-4 field is capped at 4 digits).
 *
 * Behaviors: seed 7 numbered item rows (+ Add Row), auto-fill each row's
 * Charge Value as 75% of its Retail Value (typing a charge by hand wins),
 * shared print / clear / dirty-guard via NWCAForm.
 */
(function () {
    'use strict';

    var DEFAULT_ROWS = 7;

    document.addEventListener('DOMContentLoaded', function () {
        var tbody = document.getElementById('sampleRows');
        for (var i = 0; i < DEFAULT_ROWS; i++) addRow(tbody);

        document.getElementById('addRowBtn').addEventListener('click', function () {
            addRow(tbody);
        });

        NWCAForm.init({});
    });

    function addRow(tbody) {
        var tr = document.createElement('tr');

        var num = document.createElement('td');
        num.className = 'cell-num';
        num.textContent = String(tbody.children.length + 1);
        tr.appendChild(num);

        tr.appendChild(textCell('cell-text', 'Source'));
        tr.appendChild(textCell('cell-text', 'Brand'));
        tr.appendChild(textCell('cell-text', 'Style number'));
        tr.appendChild(textCell('cell-text', 'Description'));
        tr.appendChild(textCell('cell-text', 'Color'));
        tr.appendChild(textCell('', 'Size'));
        tr.appendChild(textCell('', 'Quantity'));

        // Retail value drives the 75% charge column
        var retailTd = document.createElement('td');
        var retail = document.createElement('input');
        retail.type = 'text';
        retail.inputMode = 'decimal';
        retail.className = 'retail-value';
        retail.setAttribute('aria-label', 'Retail value');
        retailTd.appendChild(retail);
        tr.appendChild(retailTd);

        var chargeTd = document.createElement('td');
        chargeTd.className = 'cell-total';
        var charge = document.createElement('input');
        charge.type = 'text';
        charge.inputMode = 'decimal';
        charge.className = 'charge-value';
        charge.setAttribute('aria-label', 'Charge value (75% of retail)');
        chargeTd.appendChild(charge);
        tr.appendChild(chargeTd);

        retail.addEventListener('input', function () { recalcCharge(retail, charge); });
        // typing a charge by hand turns off auto-calc for that row
        charge.addEventListener('input', function () {
            charge.dataset.manual = charge.value.trim() ? '1' : '';
            if (!charge.dataset.manual) recalcCharge(retail, charge);
        });

        tr.appendChild(textCell('', 'Date returned'));
        tr.appendChild(textCell('cell-text', 'Condition / initials'));

        tbody.appendChild(tr);
    }

    function textCell(className, ariaLabel) {
        var td = document.createElement('td');
        if (className) td.className = className;
        var input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('aria-label', ariaLabel);
        td.appendChild(input);
        return td;
    }

    function recalcCharge(retail, charge) {
        if (charge.dataset.manual === '1') return;
        var value = parseFloat(String(retail.value).replace(/[$,\s]/g, ''));
        // Money rounding: cents, not floating dust
        charge.value = isNaN(value) ? '' : (Math.round(value * 75) / 100).toFixed(2);
    }
})();
