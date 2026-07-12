/**
 * injury-report-form.js — pages/forms/injury-report-form.html
 *
 * Same-day incident documentation (injuries, near-misses, property damage).
 * Equipment checkboxes mirror the 6 maintenance-log machines so incident
 * history lines up with the maintenance history per machine. The DOSH
 * 8-hour hospitalization notice + L&I claim reminder print ON the form —
 * the day you need this form is the day nobody remembers the rules.
 * company = EMPLOYEE NAME; Save to NWCA → Forms Inbox (INJ, status "Open").
 */
(function () {
    'use strict';

    var KIND_CHECKS = [
        ['knInjury', 'Injury'], ['knNearMiss', 'Near-miss'], ['knProperty', 'Property / equipment damage'],
    ];
    var EQUIP_CHECKS = [
        ['eqEmb', 'Embroidery machine'], ['eqKornit', 'Kornit DTG'], ['eqHeatPress', 'Heat press'],
        ['eqLaser', 'Laser'], ['eqRoland', 'Roland printer'], ['eqCompressor', 'Air compressor'],
    ];
    var RESPONSE_CHECKS = [
        ['rsFirstAid', 'First aid given on site'], ['rsMedical', 'Medical treatment sought'],
        ['rsDeclined', 'Treatment offered & declined'], ['rsWorkMissed', 'Time / work missed'],
    ];

    document.addEventListener('DOMContentLoaded', function () {
        NWCAForm.init({});
        NWCAFormSave.init({ formId: 'injury-report', build: buildSubmission });
        NWCAFormDates.attach('fldDate');
        if (!document.getElementById('fldDate').value) {
            document.getElementById('fldDate').value = NWCAFormDates.today();
        }
        NWCAForm.autosave({ key: 'injury-report' });
    });

    function buildSubmission() {
        var V = NWCAFormSave.val;
        var checksList = [];
        KIND_CHECKS.concat(EQUIP_CHECKS, RESPONSE_CHECKS).forEach(function (p) {
            if (NWCAFormSave.checked(p[0])) checksList.push(p[1]);
        });
        if (NWCAFormSave.checked('eqOther')) checksList.push('Other equipment: ' + (V('eqOtherText') || '?'));

        var kind = KIND_CHECKS.filter(function (p) { return NWCAFormSave.checked(p[0]); }).map(function (p) { return p[1]; });
        var equip = EQUIP_CHECKS.filter(function (p) { return NWCAFormSave.checked(p[0]); }).map(function (p) { return p[1]; });

        return {
            company: V('fldCompany'), // employee name — the Inbox shows who it's about
            contactName: V('fldSupervisor'),
            phone: '',
            email: '',
            customerNumber: '',
            salesRep: '',
            dueDateText: '',
            summary: (kind[0] || 'kind not marked') + (equip[0] ? ' · ' + equip[0] : '') +
                     ' · ' + (V('fldDate') || '?') + (V('fldClaim') ? ' · L&I ' + V('fldClaim') : ''),
            payload: {
                fields: [
                    ['Employee', V('fldCompany')], ['Job title', V('fldTitle')],
                    ['Date of incident', V('fldDate')], ['Time', V('fldTime')],
                    ['Location on premises', V('fldLocation')], ['Supervisor notified / when', V('fldSupervisor')],
                    ['Body part(s)', V('fldBodyPart')], ['Witnesses', V('fldWitnesses')],
                    ['First aid by', V('fldFirstAidBy')], ['Treated at', V('fldTreatedAt')],
                    ['L&I claim #', V('fldClaim')],
                ],
                checks: checksList,
                tables: [],
                notes: [
                    ['What happened', V('fldWhatHappened')],
                    ['Corrective action', V('fldCorrective')],
                ],
            },
        };
    }
})();
