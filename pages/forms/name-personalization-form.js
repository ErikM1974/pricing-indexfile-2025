/**
 * name-personalization-form.js — pages/forms/name-personalization-form.html
 *
 * Fill-in-the-browser twin of /forms/customer-name-personalization-form.pdf.
 * Nothing is saved anywhere — print / Save as PDF is the output.
 *
 * Behaviors: seed 20 numbered name rows (+ Add Row), auto-fill "Total Names"
 * from non-empty Name cells (typing a total by hand wins), shared print /
 * clear / dirty-guard via NWCAForm.
 */
(function () {
    'use strict';

    var DEFAULT_ROWS = 20;

    document.addEventListener('DOMContentLoaded', function () {
        var tbody = document.getElementById('nameRows');
        seedRows(tbody);

        document.getElementById('addRowBtn').addEventListener('click', function () {
            addRow(tbody);
        });

        NWCAForm.init({
            onAfterClear: function () { recalcTotal(); }
        });
        NWCAFormContacts.attach({ input: document.getElementById('fldCompany') });
        NWCAFormSave.init({ formId: 'name-personalization', build: buildSubmission });
        NWCAFormDates.attach('fldDueDate', 'fldSignDate');
        NWCAForm.staffFill(['fldSalesRep', 'fldReceivedBy']);
        NWCAForm.autosave({ key: 'name-personalization', tables: [{ tbody: tbody, addRow: function () { addRow(tbody); } }] });
    });

    function buildSubmission() {
        var V = NWCAFormSave.val;
        var specs = [];
        [['methodEmbroidery', 'Embroidery'], ['methodTransfer', 'Transfer'], ['methodDtg', 'DTG']]
            .forEach(function (pair) { if (NWCAFormSave.checked(pair[0])) specs.push(pair[1]); });
        if (NWCAFormSave.checked('methodOther')) specs.push('Other: ' + (V('methodOtherText') || '?'));
        [['capAll', 'ALL CAPS'], ['capUpperLower', 'Upper/lower'], ['capAsWritten', 'As written']]
            .forEach(function (pair) { if (NWCAFormSave.checked(pair[0])) specs.push(pair[1]); });

        var rows = [];
        document.querySelectorAll('#nameRows tr').forEach(function (tr) {
            var num = tr.querySelector('.cell-num').textContent;
            var cells = Array.prototype.map.call(tr.querySelectorAll('input'), function (el) { return el.value.trim(); });
            if (cells.some(function (c) { return c; })) rows.push([num].concat(cells));
        });
        var nameCount = rows.filter(function (r) { return r[1]; }).length;

        return {
            company: V('fldCompany'),
            contactName: V('fldContact'),
            phone: V('fldPhone'),
            email: V('fldEmail'),
            customerNumber: V('fldCustomerNum'),
            salesRep: V('fldSalesRep'),
            dueDateText: V('fldDueDate'),
            summary: (V('fldTotalNames') || nameCount) + ' names · ' + (specs[0] || 'method not marked'),
            payload: {
                fields: [
                    ['Company', V('fldCompany')], ['Contact Name', V('fldContact')], ['Phone', V('fldPhone')],
                    ['Email', V('fldEmail')], ['Sales Rep', V('fldSalesRep')], ['Order / PO #', V('fldOrderPo')],
                    ['Due Date', V('fldDueDate')], ['Customer #', V('fldCustomerNum')],
                    ['Name Location', V('fldNameLocation')], ['Font', V('fldFont')],
                    ['Letter Height', V('fldLetterHeight')], ['Thread / Print Color', V('fldThreadColor')],
                    ['Total Names', V('fldTotalNames') || String(nameCount)],
                ],
                checks: specs,
                tables: [{
                    title: 'Name List',
                    columns: ['#', 'Name Exactly as Printed', 'Garment / Style', 'Color', 'Size', 'Qty', 'Special Notes'],
                    rows: rows,
                }],
                notes: [['Printed Name', V('fldPrintedName')], ['Signature Date', V('fldSignDate')], ['NWCA Received By', V('fldReceivedBy')]],
            },
        };
    }

    function seedRows(tbody) {
        for (var i = 0; i < DEFAULT_ROWS; i++) addRow(tbody);
    }

    function addRow(tbody) {
        var tr = document.createElement('tr');

        var num = document.createElement('td');
        num.className = 'cell-num';
        num.textContent = String(tbody.children.length + 1);
        tr.appendChild(num);

        tr.appendChild(inputCell('cell-text cell-name', 'Name exactly as printed', 'name-input'));
        tr.appendChild(inputCell('cell-text', 'Garment / style'));
        tr.appendChild(inputCell('cell-text', 'Color'));
        tr.appendChild(inputCell('', 'Size'));
        tr.appendChild(inputCell('', 'Quantity'));
        tr.appendChild(inputCell('cell-text', 'Special notes / garment assignment'));

        tbody.appendChild(tr);
    }

    function inputCell(className, ariaLabel, inputClass) {
        var td = document.createElement('td');
        if (className) td.className = className;
        var input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('aria-label', ariaLabel);
        if (inputClass) {
            input.className = inputClass;
            input.addEventListener('input', recalcTotal);
        }
        td.appendChild(input);
        return td;
    }

    function recalcTotal() {
        var totalInput = document.getElementById('fldTotalNames');
        if (!totalInput || totalInput.dataset.manual === '1') return;
        var count = 0;
        document.querySelectorAll('.name-input').forEach(function (el) {
            if (el.value.trim()) count++;
        });
        totalInput.value = count ? String(count) : '';
    }

    // typing a total by hand turns off auto-count
    document.addEventListener('DOMContentLoaded', function () {
        var totalInput = document.getElementById('fldTotalNames');
        totalInput.addEventListener('input', function () {
            totalInput.dataset.manual = totalInput.value.trim() ? '1' : '';
            if (!totalInput.dataset.manual) recalcTotal();
        });
    });
})();
