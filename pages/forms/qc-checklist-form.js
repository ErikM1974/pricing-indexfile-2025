/**
 * qc-checklist-form.js — pages/forms/qc-checklist-form.html
 *
 * Fillable twin of /forms/final-qc-checklist.pdf. 14-point OK/FAIL/N-A
 * inspection (mutually exclusive per row), quantity verification table,
 * final disposition. Save to NWCA → Forms Inbox (QCC prefix); a FAIL anywhere
 * or a non-RELEASE disposition is called out in the summary line.
 */
(function () {
    'use strict';

    var QC_ITEMS = [
        'Correct customer and work order',
        'Approved artwork / version used',
        'Spelling, names and numbers correct',
        'Design size and placement correct',
        'Thread / ink / transfer colors correct',
        'Registration, stitch or print quality acceptable',
        'No loose threads, press marks or residue',
        'No stains, holes, scorching or damage',
        'Garment style, color and sizes correct',
        'Personalization matched to garments',
        'Final quantities match order',
        'Folding, bagging and labels correct',
        'Packing / box instructions followed',
        'Pickup / shipping instructions verified',
    ];

    var DISPOSITIONS = [['dispRelease', 'RELEASE'], ['dispHold', 'HOLD'], ['dispRework', 'REWORK'], ['dispPartial', 'PARTIAL'], ['dispReject', 'REJECT']];
    var QTY_COLS = 7;

    document.addEventListener('DOMContentLoaded', function () {
        var qcBody = document.getElementById('qcRows');
        QC_ITEMS.forEach(function (item) {
            var tr = document.createElement('tr');
            tr.innerHTML = '<td class="cell-item">' + item + '</td>' +
                ['ok', 'fail', 'na'].map(function (mark) {
                    return '<td class="cell-mark cell-mark--' + mark + '"><input type="checkbox" class="qc-' + mark + '" data-item="' + item.replace(/"/g, '&quot;') + '" aria-label="' + mark.toUpperCase() + '"></td>';
                }).join('');
            qcBody.appendChild(tr);
        });
        // OK / FAIL / N-A mutually exclusive per row
        qcBody.addEventListener('change', function (e) {
            if (!e.target.matches('input[type="checkbox"]')) return;
            if (e.target.checked) {
                e.target.closest('tr').querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
                    if (cb !== e.target) cb.checked = false;
                });
            }
        });

        var qtyBody = document.getElementById('qtyRows');
        for (var i = 0; i < 3; i++) addQtyRow(qtyBody);
        document.getElementById('addRowBtn').addEventListener('click', function () { addQtyRow(qtyBody); });

        // dispositions mutually exclusive
        DISPOSITIONS.forEach(function (p) {
            document.getElementById(p[0]).addEventListener('change', function (e) {
                if (!e.target.checked) return;
                DISPOSITIONS.forEach(function (q) { if (q[0] !== p[0]) document.getElementById(q[0]).checked = false; });
            });
        });

        NWCAForm.init({});
        NWCAFormContacts.attach({ input: document.getElementById('fldCompany') });
        NWCAFormSave.init({ formId: 'final-qc-checklist', build: buildSubmission });
        NWCAFormDates.attach('fldInspectionDate', 'fldSigDate');
        if (!document.getElementById('fldInspectionDate').value) document.getElementById('fldInspectionDate').value = NWCAFormDates.today();
        NWCAForm.staffFill(['fldInspector']);
        NWCAForm.autosave({
            key: 'final-qc-checklist',
            tables: [
                { tbody: qcBody, addRow: null },
                { tbody: qtyBody, addRow: function () { addQtyRow(qtyBody); } },
            ],
        });
    });

    function addQtyRow(tbody) {
        var tr = document.createElement('tr');
        for (var c = 0; c < QTY_COLS; c++) {
            var td = document.createElement('td');
            if (c === 0 || c === 1 || c === 6) td.className = 'cell-text';
            var input = document.createElement('input');
            input.type = 'text';
            input.setAttribute('aria-label', ['Style / item', 'Color', 'Ordered', 'Completed', 'Passed', 'Rejected', 'Notes'][c]);
            td.appendChild(input);
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }

    function buildSubmission() {
        var V = NWCAFormSave.val;
        var decoration = [];
        [['dEmbroidery', 'Embroidery'], ['dDtg', 'DTG'], ['dDtf', 'DTF / Transfer'], ['dScreen', 'Screen Print'],
         ['dLaser', 'Laser'], ['dStickers', 'Stickers / Banners'], ['dPatches', 'Patches']]
            .forEach(function (p) { if (NWCAFormSave.checked(p[0])) decoration.push(p[1]); });

        var qcRows = [];
        var failCount = 0;
        document.querySelectorAll('#qcRows tr').forEach(function (tr) {
            var item = tr.querySelector('.cell-item').textContent;
            var mark = tr.querySelector('.qc-ok').checked ? 'OK'
                : (tr.querySelector('.qc-fail').checked ? 'FAIL' : (tr.querySelector('.qc-na').checked ? 'N/A' : '—'));
            if (mark === 'FAIL') failCount++;
            qcRows.push([item, mark]);
        });

        var qtyRows = [];
        document.querySelectorAll('#qtyRows tr').forEach(function (tr) {
            var cells = Array.prototype.map.call(tr.querySelectorAll('input'), function (el) { return el.value.trim(); });
            if (cells.some(function (c) { return c; })) qtyRows.push(cells);
        });

        var disposition = '';
        DISPOSITIONS.forEach(function (p) { if (NWCAFormSave.checked(p[0])) disposition = p[1]; });

        return {
            company: V('fldCompany'),
            contactName: V('fldInspector'),
            phone: '',
            email: '',
            customerNumber: '',
            salesRep: V('fldInspector'),
            dueDateText: '',
            summary: 'WO ' + (V('fldWorkOrder') || '?') + ' · ' + (disposition || 'no disposition') +
                     (failCount ? ' · ⚠ ' + failCount + ' FAIL' + (failCount === 1 ? '' : 'S') : ' · all OK/NA'),
            payload: {
                fields: [
                    ['Work Order', V('fldWorkOrder')], ['Customer', V('fldCompany')],
                    ['Department', V('fldDepartment')], ['QC Inspector', V('fldInspector')],
                    ['Inspection Date / Time', V('fldInspectionDate')],
                    ['Final Disposition', disposition],
                ],
                checks: decoration.concat(disposition ? ['Disposition: ' + disposition] : []),
                tables: [
                    { title: 'Inspection Checklist', columns: ['Check', 'Result'], rows: qcRows },
                    { title: 'Quantity Verification', columns: ['Style / Item', 'Color', 'Ordered', 'Completed', 'Passed', 'Rejected', 'Notes'], rows: qtyRows },
                ],
                notes: [
                    ['QC Exceptions', V('fldExceptions')],
                    ['Inspector Signature / Initials', V('fldInspectorSig')], ['Date', V('fldSigDate')],
                ],
            },
        };
    }
})();
