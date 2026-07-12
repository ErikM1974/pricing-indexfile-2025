/**
 * webstore-request-form.js — pages/forms/webstore-request-form.html
 *
 * Company-store intake: window vs always-on, who pays (company / employee /
 * split allowance), fulfillment model, product lineup (SanMar lookup rows),
 * logos + approver. One sheet replaces the email scavenger hunt that
 * normally precedes an Inksoft store build.
 * Save to NWCA → Forms Inbox (WSR prefix); Due_Date = target launch.
 */
(function () {
    'use strict';

    var DEFAULT_ROWS = 5;

    var CHECKS = [
        ['stWindow', 'Order window'], ['stAlwaysOn', 'Always-on store'],
        ['payCompany', 'Company pays all'], ['payEmployee', 'Employees pay'], ['paySplit', 'Split — allowance'],
        ['shipBulk', 'Bulk ship to company'], ['shipIndividual', 'Ship to each buyer'], ['shipPickup', 'Pickup at NWCA'],
    ];

    document.addEventListener('DOMContentLoaded', function () {
        var tbody = document.getElementById('storeRows');
        for (var i = 0; i < DEFAULT_ROWS; i++) addRow(tbody);
        document.getElementById('addRowBtn').addEventListener('click', function () { addRow(tbody); });

        NWCAForm.init({});
        NWCAFormContacts.attach({ input: document.getElementById('fldCompany') });
        NWCAFormSave.init({ formId: 'webstore-request', build: buildSubmission });
        NWCAFormDates.attach('fldLaunchDate', 'fldOpenDate', 'fldCloseDate');
        NWCAForm.staffFill(['fldSalesRep']);
        NWCAForm.autosave({ key: 'webstore-request', tables: [{ tbody: tbody, addRow: function () { addRow(tbody); } }] });
    });

    function addRow(tbody) {
        var tr = document.createElement('tr');
        var styleTd = cell('cell-style', 'Style');
        tr.appendChild(styleTd);
        var colorTd = cell('cell-color', 'Color');
        tr.appendChild(colorTd);
        var descTd = cell('cell-desc', 'Description');
        tr.appendChild(descTd);
        tr.appendChild(cell('cell-deco', 'Decoration method'));
        tr.appendChild(cell('cell-place', 'Logo placement'));
        tbody.appendChild(tr);

        var descInput = descTd.querySelector('input');
        descInput.addEventListener('input', function (e) {
            if (e.isTrusted) descInput.dataset.manual = descInput.value.trim() ? '1' : '';
        });
        NWCAFormStyles.attachRow({
            styleInput: styleTd.querySelector('input'),
            colorCell: colorTd,
            descInput: descInput,
        });
    }

    function cell(className, ariaLabel) {
        var td = document.createElement('td');
        td.className = 'cell-text ' + className;
        var input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('aria-label', ariaLabel);
        td.appendChild(input);
        return td;
    }

    function buildSubmission() {
        var V = NWCAFormSave.val;
        var checksList = [];
        CHECKS.forEach(function (p) { if (NWCAFormSave.checked(p[0])) checksList.push(p[1]); });

        var rows = [];
        document.querySelectorAll('#storeRows tr').forEach(function (tr) {
            var colorInput = tr.querySelector('.cell-color input');
            var cells = [
                tr.querySelector('.cell-style input').value.trim(),
                colorInput.value.trim() + (colorInput.dataset.catalogColor ? ' [' + colorInput.dataset.catalogColor + ']' : ''),
                tr.querySelector('.cell-desc input').value.trim(),
                tr.querySelector('.cell-deco input').value.trim(),
                tr.querySelector('.cell-place input').value.trim(),
            ];
            if (cells.some(function (c) { return c; })) rows.push(cells);
        });

        var funding = NWCAFormSave.checked('payCompany') ? 'company-paid'
            : NWCAFormSave.checked('paySplit') ? 'split allowance'
            : NWCAFormSave.checked('payEmployee') ? 'employee-paid' : 'funding not marked';

        return {
            company: V('fldCompany'),
            contactName: V('fldContact'),
            phone: V('fldPhone'),
            email: V('fldEmail'),
            customerNumber: '',
            salesRep: V('fldSalesRep'),
            dueDateText: V('fldLaunchDate'),
            summary: 'Store · ' + funding + ' · ' + rows.length + ' product' + (rows.length === 1 ? '' : 's') +
                     (V('fldOpenDate') ? ' · window ' + V('fldOpenDate') + '–' + (V('fldCloseDate') || '?') : '') +
                     (V('fldLaunchDate') ? ' · launch ' + V('fldLaunchDate') : ''),
            payload: {
                fields: [
                    ['Company', V('fldCompany')], ['Store contact', V('fldContact')],
                    ['Phone', V('fldPhone')], ['Email', V('fldEmail')],
                    ['Sales Rep', V('fldSalesRep')], ['Target launch', V('fldLaunchDate')],
                    ['Window opens', V('fldOpenDate')], ['Window closes', V('fldCloseDate')],
                    ['Approx. buyers', V('fldHeadcount')],
                    ['Allowance per employee $', V('fldAllowance')],
                    ['Bulk ship-to', V('fldShipTo')],
                    ['Logos / files', V('fldLogos')], ['Mockup approver', V('fldApprover')],
                ],
                checks: checksList,
                tables: [{
                    title: 'Products Wanted',
                    columns: ['Style #', 'Color', 'Description', 'Decoration', 'Logo placement'],
                    rows: rows,
                }],
                notes: [['Notes', V('fldNotes')]],
            },
        };
    }
})();
