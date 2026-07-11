/**
 * garment-drop-off-form.js — pages/forms/garment-drop-off-form.html
 *
 * Fill-in-the-browser twin of /forms/customer-garment-drop-off-form.pdf.
 * Nothing is saved anywhere — staff/customer types, then Print / Save as PDF
 * produces the filled copy (window.print → browser "Save as PDF").
 *
 * Behaviors: seed 5 garment rows (+ Add Row), auto-total each row from the
 * size counts (manual edit of Total wins). Print / clear / dirty-guard come
 * from nwca-form-shared.js (NWCAForm).
 */
(function () {
    'use strict';

    var SIZE_COUNT = 6; // S M L XL 2XL 3XL
    var DEFAULT_ROWS = 5;

    document.addEventListener('DOMContentLoaded', function () {
        var tbody = document.getElementById('garmentRows');
        for (var i = 0; i < DEFAULT_ROWS; i++) addRow(tbody);

        document.getElementById('addRowBtn').addEventListener('click', function () {
            addRow(tbody);
        });

        NWCAForm.init({});
        NWCAFormContacts.attach({ input: document.getElementById('fldCompany') });
        NWCAFormSave.init({ formId: 'garment-drop-off', build: buildSubmission });
        NWCAFormDates.attach('fldDateIn', 'fldDateNeeded', 'fldSignDate');
        if (!document.getElementById('fldDateIn').value) document.getElementById('fldDateIn').value = NWCAFormDates.today();
        NWCAForm.staffFill(['fldReceivedBy']);
        NWCAForm.autosave({ key: 'garment-drop-off', tables: [{ tbody: tbody, addRow: function () { addRow(tbody); } }] });
    });

    function buildSubmission() {
        var V = NWCAFormSave.val;
        var decoration = [];
        [['decoEmbroidery', 'Embroidery'], ['decoDtg', 'DTG Printing'], ['decoScreen', 'Screen Printing'], ['decoTransfers', 'Transfers']]
            .forEach(function (pair) { if (NWCAFormSave.checked(pair[0])) decoration.push(pair[1]); });
        if (NWCAFormSave.checked('decoOther')) decoration.push('Other: ' + (V('decoOtherText') || '?'));

        var rows = [];
        var totalPieces = 0;
        document.querySelectorAll('#garmentRows tr').forEach(function (tr) {
            var cells = Array.prototype.map.call(tr.querySelectorAll('input'), function (el) { return el.value.trim(); });
            if (cells.some(function (c) { return c; })) {
                rows.push(cells);
                totalPieces += parseInt(cells[cells.length - 1], 10) || 0;
            }
        });

        return {
            company: V('fldCompany'),
            contactName: V('fldContact'),
            phone: V('fldPhone'),
            email: V('fldEmail'),
            customerNumber: V('fldCustomerNum'),
            salesRep: V('fldReceivedBy'),
            dueDateText: V('fldDateNeeded'),
            summary: totalPieces + ' pcs · ' + (decoration.join(', ') || 'no method marked'),
            payload: {
                fields: [
                    ['Company', V('fldCompany')], ['Contact Name', V('fldContact')], ['Phone', V('fldPhone')],
                    ['Email', V('fldEmail')], ['Date In', V('fldDateIn')], ['Date Needed', V('fldDateNeeded')],
                    ['PO #', V('fldPo')], ['Customer #', V('fldCustomerNum')], ['Received By', V('fldReceivedBy')],
                ],
                checks: decoration,
                tables: [{
                    title: 'Garment Details',
                    columns: ['Brand / Style #', 'Color', 'Description', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'Other', 'Total'],
                    rows: rows,
                }],
                notes: [['Order Notes', V('fldNotes')], ['Printed Name', V('fldPrintedName')], ['Signature Date', V('fldSignDate')]],
            },
        };
    }

    function addRow(tbody) {
        var tr = document.createElement('tr');

        tr.appendChild(textCell('cell-text cell-style', 'Brand / style #'));
        tr.appendChild(textCell('cell-text cell-color', 'Color'));
        tr.appendChild(textCell('cell-text cell-desc', 'Product description'));

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

        tr.appendChild(textCell('cell-text cell-other', 'e.g. 4XL x 2'));

        var totalTd = document.createElement('td');
        totalTd.className = 'cell-total';
        var totalInput = document.createElement('input');
        totalInput.type = 'text';
        totalInput.className = 'row-total';
        totalInput.setAttribute('aria-label', 'Total garments in row');
        // typing a total by hand turns off auto-calc for that row
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
