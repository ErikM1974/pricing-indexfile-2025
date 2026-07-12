/**
 * webstore-inquiry.js — pages/webstore-inquiry.html (PUBLIC customer lead form)
 *
 * Customer-toned company-store inquiry. Replaces webstore-info.html's
 * mailto: CTA — store leads now arrive with type, funding, headcount,
 * launch window, and product ideas instead of a blank email.
 * Saves as formId webstore-request (WSR) — SAME Inbox bucket as the staff
 * twin, tagged "Submitted by: Customer (web)" — and fires the Slack lead ping.
 */
(function () {
    'use strict';

    var CHECKS = [
        ['stWindow', 'Order window'], ['stAlwaysOn', 'Always-open store'], ['stNotSure', 'Type: not sure yet'],
        ['payCompany', 'Company pays'], ['payEmployee', 'Employees pay'], ['paySplit', 'Mix — company allowance'],
    ];

    document.addEventListener('DOMContentLoaded', function () {
        NWCAFormDates.attach('fldLaunch');
        NWCAPublicForm.init({
            formId: 'webstore-request',
            submitId: 'submitStoreBtn',
            required: [
                ['fldName', 'your name'],
                ['fldCompany', 'your company or organization'],
                ['fldEmail', 'a valid email'],
            ],
            build: buildSubmission,
        });
    });

    function buildSubmission() {
        var V = NWCAPublicForm.val;
        var checksList = [];
        CHECKS.forEach(function (p) { if (NWCAPublicForm.checked(p[0])) checksList.push(p[1]); });

        var funding = NWCAPublicForm.checked('payCompany') ? 'company-paid'
            : NWCAPublicForm.checked('paySplit') ? 'mixed funding'
            : NWCAPublicForm.checked('payEmployee') ? 'employee-paid' : 'funding open';

        return {
            company: V('fldCompany'),
            contactName: V('fldName'),
            phone: V('fldPhone'),
            email: V('fldEmail'),
            dueDateText: V('fldLaunch'),
            summary: 'WEB LEAD · ' + funding +
                     (V('fldHeadcount') ? ' · ~' + V('fldHeadcount') + ' buyers' : '') +
                     (V('fldLaunch') ? ' · live by ' + V('fldLaunch') : ''),
            payload: {
                fields: [
                    ['Name', V('fldName')], ['Company / Organization', V('fldCompany')],
                    ['Email', V('fldEmail')], ['Phone', V('fldPhone')],
                    ['Approx. buyers', V('fldHeadcount')], ['Wanted live by', V('fldLaunch')],
                    ['Submitted by', 'Customer (web inquiry)'],
                ],
                checks: checksList,
                tables: [],
                notes: [
                    ['Products wanted', V('fldProducts')],
                    ['Notes / questions', V('fldNotes')],
                ],
            },
        };
    }
})();
