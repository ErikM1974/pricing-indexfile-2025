/**
 * pto-request-form.js — pages/forms/pto-request-form.html
 *
 * Time-off request: employee (staffFill), leave type (labels stay generic —
 * the Employee Handbook is the authority on what each type means), date
 * range, coverage. Saves with company = EMPLOYEE NAME (the Inbox "Company"
 * column reads as who the request is about) and Due_Date = first day off so
 * upcoming leave surfaces in the due widget. Default status "Pending";
 * manager approves/denies via the Inbox status dropdown (PTO prefix).
 */
(function () {
    'use strict';

    var TYPE_CHECKS = [
        ['tpVacation', 'Vacation / PTO'], ['tpSick', 'Sick / Safe leave'], ['tpPersonal', 'Personal'],
        ['tpUnpaid', 'Unpaid'], ['tpBereavement', 'Bereavement'], ['tpJury', 'Jury duty'],
    ];

    document.addEventListener('DOMContentLoaded', function () {
        NWCAForm.init({});
        NWCAFormSave.init({ formId: 'pto-request', build: buildSubmission });
        NWCAFormDates.attach('fldSubmitted', 'fldFirstDay', 'fldLastDay', 'fldReturnDay');
        if (!document.getElementById('fldSubmitted').value) {
            document.getElementById('fldSubmitted').value = NWCAFormDates.today();
        }
        NWCAForm.staffFill(['fldCompany']);
        NWCAForm.autosave({ key: 'pto-request' });
    });

    function buildSubmission() {
        var V = NWCAFormSave.val;
        var types = [];
        TYPE_CHECKS.forEach(function (p) { if (NWCAFormSave.checked(p[0])) types.push(p[1]); });
        if (NWCAFormSave.checked('tpOther')) types.push('Other: ' + (V('tpOtherText') || '?'));

        return {
            company: V('fldCompany'), // employee name — the Inbox list shows who it's about
            contactName: V('fldManager'),
            phone: '',
            email: '',
            customerNumber: '',
            salesRep: V('fldManager'),
            dueDateText: V('fldFirstDay'),
            summary: (types[0] || 'type not marked') + ' · ' + (V('fldFirstDay') || '?') + '–' + (V('fldLastDay') || '?') +
                     (V('fldHours') ? ' · ' + V('fldHours') : ''),
            payload: {
                fields: [
                    ['Employee', V('fldCompany')], ['Department / Role', V('fldDept')],
                    ['Date submitted', V('fldSubmitted')], ['Manager', V('fldManager')],
                    ['First day off', V('fldFirstDay')], ['Last day off', V('fldLastDay')],
                    ['Returning to work', V('fldReturnDay')], ['Total hours / days', V('fldHours')],
                    ['Coverage arranged with', V('fldCoverage')],
                ],
                checks: types,
                tables: [],
                notes: [['Notes', V('fldNotes')]],
            },
        };
    }
})();
