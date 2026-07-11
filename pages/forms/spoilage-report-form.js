/**
 * spoilage-report-form.js — pages/forms/spoilage-report-form.html
 *
 * Fillable twin of /forms/spoilage-damage-reprint-report.pdf. Item rows carry
 * per-row Loss Total = Qty × (Garment Cost + Decoration Cost) (manual wins),
 * rolling into Estimated Total Loss (manual wins). Style lookup via SanMar
 * (description autofill). Save to NWCA → Forms Inbox (SPL prefix); the loss
 * dollars + first cause land in the summary so the Inbox list reads like a
 * loss report.
 */
(function () {
    'use strict';

    var DEFAULT_ROWS = 3;

    var CAUSES = [
        ['cVendor', 'Vendor Defect'], ['cWrongGarment', 'Wrong Garment / Size'], ['cWrongArt', 'Wrong Artwork / Version'],
        ['cWrongColor', 'Wrong Color'], ['cPlacement', 'Placement / Alignment'], ['cMachine', 'Machine / Equipment'],
        ['cOperator', 'Operator / Setup'], ['cDye', 'Dye Migration / Scorching'], ['cNeedle', 'Needle / Hoop Damage'],
        ['cHeatPress', 'Heat Press Issue'], ['cContamination', 'Contamination / Stain'],
    ];

    var FOUND_AT = [
        ['whReceiving', 'Receiving'], ['whSetup', 'Setup / First Piece'], ['whProduction', 'During Production'],
        ['whFinalQc', 'Final QC'], ['whPacking', 'Packing'], ['whComplaint', 'Customer Complaint'],
    ];

    document.addEventListener('DOMContentLoaded', function () {
        var tbody = document.getElementById('spoilRows');
        for (var i = 0; i < DEFAULT_ROWS; i++) addRow(tbody);
        document.getElementById('addRowBtn').addEventListener('click', function () { addRow(tbody); });

        var totalLoss = document.getElementById('fldTotalLoss');
        totalLoss.addEventListener('input', function (e) {
            if (e.isTrusted) totalLoss.dataset.manual = totalLoss.value.trim() ? '1' : '';
        });

        NWCAForm.init({ onAfterClear: function () { recalcTotalLoss(); } });
        NWCAFormContacts.attach({ input: document.getElementById('fldCompany') });
        NWCAFormSave.init({ formId: 'spoilage-report', build: buildSubmission });
    });

    function money(n) { return (Math.round(n * 100) / 100).toFixed(2); }
    function num(v) { var n = parseFloat(String(v).replace(/[$,\s]/g, '')); return isNaN(n) ? null : n; }

    function addRow(tbody) {
        var tr = document.createElement('tr');

        var styleTd = textCell('cell-text cell-style', 'Style');
        tr.appendChild(styleTd);
        var descTd = textCell('cell-text cell-desc', 'Description');
        tr.appendChild(descTd);
        var colorTd = textCell('cell-text cell-color', 'Color');
        tr.appendChild(colorTd);
        tr.appendChild(textCell('', 'Size'));

        var qty = numCell(tr, 'row-qty', 'Quantity');
        tr.appendChild(qty.td);
        var g = numCell(tr, 'row-garment', 'Garment cost');
        tr.appendChild(g.td);
        var d = numCell(tr, 'row-deco', 'Decoration cost');
        tr.appendChild(d.td);

        var lossTd = document.createElement('td');
        lossTd.className = 'cell-total';
        var loss = document.createElement('input');
        loss.type = 'text';
        loss.inputMode = 'decimal';
        loss.className = 'row-loss';
        loss.setAttribute('aria-label', 'Loss total');
        loss.addEventListener('input', function () {
            loss.dataset.manual = loss.value.trim() ? '1' : '';
            if (!loss.dataset.manual) recalcRow(tr);
            recalcTotalLoss();
        });
        lossTd.appendChild(loss);
        tr.appendChild(lossTd);

        tr.appendChild(textCell('cell-text cell-disp', 'Disposition'));

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

    function textCell(className, ariaLabel) {
        var td = document.createElement('td');
        td.className = className;
        var input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('aria-label', ariaLabel);
        td.appendChild(input);
        return td;
    }

    function numCell(tr, className, ariaLabel) {
        var td = document.createElement('td');
        var input = document.createElement('input');
        input.type = 'text';
        input.inputMode = 'decimal';
        input.className = className;
        input.setAttribute('aria-label', ariaLabel);
        input.addEventListener('input', function () { recalcRow(tr); });
        td.appendChild(input);
        return { td: td, input: input };
    }

    function recalcRow(tr) {
        var loss = tr.querySelector('.row-loss');
        if (loss.dataset.manual !== '1') {
            var qty = num(tr.querySelector('.row-qty').value);
            var g = num(tr.querySelector('.row-garment').value) || 0;
            var d = num(tr.querySelector('.row-deco').value) || 0;
            loss.value = (qty !== null && (g || d)) ? money(qty * (g + d)) : '';
        }
        recalcTotalLoss();
    }

    function recalcTotalLoss() {
        var total = document.getElementById('fldTotalLoss');
        if (total.dataset.manual === '1') return;
        var sum = 0;
        var any = false;
        document.querySelectorAll('#spoilRows .row-loss').forEach(function (el) {
            var n = num(el.value);
            if (n !== null) { sum += n; any = true; }
        });
        total.value = any ? money(sum) : '';
    }

    function buildSubmission() {
        var V = NWCAFormSave.val;
        var checksList = [];
        FOUND_AT.forEach(function (p) { if (NWCAFormSave.checked(p[0])) checksList.push('Found at: ' + p[1]); });
        var causes = [];
        CAUSES.forEach(function (p) { if (NWCAFormSave.checked(p[0])) causes.push(p[1]); });
        if (NWCAFormSave.checked('cOther')) causes.push('Other: ' + (V('cOtherText') || '?'));

        var rows = [];
        var totalQty = 0;
        document.querySelectorAll('#spoilRows tr').forEach(function (tr) {
            var cells = Array.prototype.map.call(tr.querySelectorAll('input'), function (el) { return el.value.trim(); });
            if (cells.some(function (c) { return c; })) {
                rows.push(cells);
                totalQty += parseInt(cells[4], 10) || 0;
            }
        });

        return {
            company: V('fldCompany'),
            contactName: V('fldReportedBy'),
            phone: '',
            email: '',
            customerNumber: '',
            salesRep: V('fldSupervisor'),
            dueDateText: '',
            summary: totalQty + ' pcs lost · $' + (V('fldTotalLoss') || '?') + ' · ' + (causes[0] || 'cause not marked') +
                     ' · WO ' + (V('fldWorkOrder') || '?'),
            payload: {
                fields: [
                    ['Work Order', V('fldWorkOrder')], ['Customer', V('fldCompany')],
                    ['Department', V('fldDepartment')], ['Machine / Station', V('fldMachine')],
                    ['Date / Time', V('fldDateTime')], ['Reported By', V('fldReportedBy')],
                    ['Estimated Total Loss $', V('fldTotalLoss')],
                    ['Replacement PO / WO', V('fldReplacementPo')], ['Resolution Status', V('fldStatus')],
                    ['Supervisor Approval', V('fldSupervisor')], ['Closed Date', V('fldClosedDate')],
                ],
                checks: checksList.concat(causes),
                tables: [{
                    title: 'Damaged / Spoiled Items',
                    columns: ['Style', 'Description', 'Color', 'Size', 'Qty', 'Garment Cost', 'Decoration Cost', 'Loss Total', 'Disposition'],
                    rows: rows,
                }],
                notes: [['Root Cause', V('fldRootCause')], ['Corrective Action', V('fldCorrective')]],
            },
        };
    }
})();
