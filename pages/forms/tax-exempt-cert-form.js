/**
 * tax-exempt-cert-form.js — pages/forms/tax-exempt-cert-form.html
 *
 * Records WHY a customer is sold tax-free: exemption type, permit #, and —
 * the audit-critical part — the EXPIRATION date, which saves as Due_Date so
 * the Forms Inbox "due in 7 days" flag fires before the certificate lapses
 * (an expired cert on file is exactly what a WA DOR audit dings).
 * Save to NWCA → Forms Inbox (TAX prefix).
 */
(function () {
    'use strict';

    var EX_CHECKS = [
        ['exResale', 'WA resale (reseller permit)'], ['exNonprofit', 'Nonprofit exemption'],
        ['exGov', 'Government'], ['exTribal', 'Tribal'], ['exOutOfState', 'Out-of-state (no WA nexus)'],
    ];

    document.addEventListener('DOMContentLoaded', function () {
        NWCAForm.init({});
        NWCAFormContacts.attach({ input: document.getElementById('fldCompany') });
        NWCAFormSave.init({ formId: 'tax-exempt-cert', build: buildSubmission });
        NWCAFormDates.attach('fldIssued', 'fldExpires');
        NWCAForm.autosave({ key: 'tax-exempt-cert' });
    });

    function buildSubmission() {
        var V = NWCAFormSave.val;
        var checksList = [];
        EX_CHECKS.forEach(function (p) { if (NWCAFormSave.checked(p[0])) checksList.push(p[1]); });
        if (NWCAFormSave.checked('exOther')) checksList.push('Other: ' + (V('exOtherText') || '?'));

        return {
            company: V('fldCompany'),
            contactName: V('fldContact'),
            phone: V('fldPhone'),
            email: V('fldEmail'),
            customerNumber: '',
            salesRep: '',
            // Due_Date = certificate expiration → the Inbox flags it 7 days out
            dueDateText: V('fldExpires'),
            summary: (checksList[0] || 'type not marked') + ' · #' + (V('fldPermit') || '?') +
                     (V('fldExpires') ? ' · expires ' + V('fldExpires') : ' · NO EXPIRATION TYPED'),
            payload: {
                fields: [
                    ['Company', V('fldCompany')], ['Contact', V('fldContact')],
                    ['Phone', V('fldPhone')], ['Email', V('fldEmail')],
                    ['Permit / certificate #', V('fldPermit')],
                    ['Issued', V('fldIssued')], ['Expires', V('fldExpires')],
                    ['Resells / why exempt', V('fldResells')],
                    ['Certificate copy location', V('fldCertFile')],
                ],
                checks: checksList,
                tables: [],
                notes: [],
            },
        };
    }
})();
