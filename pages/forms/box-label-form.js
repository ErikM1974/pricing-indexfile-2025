/**
 * box-label-form.js — pages/forms/box-label-form.html
 *
 * Fill-in-the-browser twin of /forms/box-label.pdf — the 8.5×11 sheet taped to
 * the front of a shirt box so factory staff can see what's inside. Print-only:
 * box labels are not saved to Caspio (the box IS the record).
 *
 * Behaviors: 6 style rows (+ Add Row), per-row auto-total from size counts
 * (manual override wins), customer lookup on the Customer field (NWCAFormContacts),
 * shared print / clear / dirty-guard via NWCAForm.
 */
(function () {
    'use strict';

    var SIZE_COUNT = 6; // S M L XL 2XL 3XL
    var DEFAULT_ROWS = 6;

    document.addEventListener('DOMContentLoaded', function () {
        var tbody = document.getElementById('labelRows');
        for (var i = 0; i < DEFAULT_ROWS; i++) addRow(tbody);

        NWCAForm.init({});

        // Customer lookup — fills just the big Customer box on this form
        NWCAFormContacts.attach({
            input: document.getElementById('fldCustomer'),
            onPick: function (company) {
                document.getElementById('fldCustomer').value = company.Company_Name || '';
            }
        });
        NWCAFormDates.attach('fldDueDate', 'fldDropDead');
        NWCAForm.autosave({ key: 'box-label', tables: [{ tbody: tbody, addRow: function () { addRow(tbody); } }] });
    });

    function addRow(tbody) {
        var tr = document.createElement('tr');

        tr.appendChild(textCell('cell-text', 'Style'));
        tr.appendChild(textCell('cell-text', 'Description'));
        tr.appendChild(textCell('cell-text', 'Color'));

        for (var s = 0; s < SIZE_COUNT; s++) {
            var td = document.createElement('td');
            var input = document.createElement('input');
            input.type = 'number';
            input.min = '0';
            input.className = 'size-qty';
            input.setAttribute('aria-label', 'Size quantity');
            input.addEventListener('input', function () { recalcRow(tr); });
            td.appendChild(input);
            tr.appendChild(td);
        }

        tr.appendChild(textCell('cell-text', 'Other sizes'));

        var totalTd = document.createElement('td');
        totalTd.className = 'cell-total';
        var totalInput = document.createElement('input');
        totalInput.type = 'text';
        totalInput.className = 'row-total';
        totalInput.setAttribute('aria-label', 'Row total');
        totalInput.addEventListener('input', function () {
            totalInput.dataset.manual = totalInput.value.trim() ? '1' : '';
            if (!totalInput.dataset.manual) recalcRow(tr);
        });
        totalTd.appendChild(totalInput);
        tr.appendChild(totalTd);

        tbody.appendChild(tr);
    }

    function textCell(className, ariaLabel) {
        var td = document.createElement('td');
        td.className = className;
        var input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('aria-label', ariaLabel);
        td.appendChild(input);
        return td;
    }

    function recalcRow(tr) {
        var totalInput = tr.querySelector('.row-total');
        if (!totalInput || totalInput.dataset.manual === '1') return;
        var sum = 0;
        var any = false;
        tr.querySelectorAll('.size-qty').forEach(function (el) {
            var n = parseInt(el.value, 10);
            if (!isNaN(n)) { sum += n; any = true; }
        });
        totalInput.value = any ? String(sum) : '';
    }
})();
