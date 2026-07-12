/**
 * customer-onboarding-form.js — pages/forms/customer-onboarding-form.html
 *
 * New-account intake: company, contacts, addresses, tax status, terms, and
 * decoration profile on ONE sheet so nobody retypes it into three systems.
 * The company lookup is deliberately wired so that a MATCH means "this
 * customer already exists" — the intel banner is the duplicate-account guard.
 * Save to NWCA → Forms Inbox (ONB prefix). Office checklist (SW customer →
 * CRM sync → portal invite) lives on the form + the Inbox status flow.
 */
(function () {
    'use strict';

    var TAX_CHECKS = [
        ['taxTaxable', 'Taxable (WA sales tax)'],
        ['taxResale', 'Tax-exempt — resale'],
        ['taxOther', 'Tax-exempt — nonprofit / government'],
    ];
    var TERM_CHECKS = [
        ['termsCard', 'Card on file'], ['termsPrepay', 'Prepay / 50% deposit'],
        ['termsNet15', 'Net 15'], ['termsNet30', 'Net 30 (credit app required)'],
        ['chkPoRequired', 'PO required'],
    ];
    var METHOD_CHECKS = [
        ['mEmbroidery', 'Embroidery'], ['mDtg', 'DTG'], ['mScreen', 'Screen Printing'],
        ['mTransfers', 'DTF Transfers'], ['mLaser', 'Laser Engraving'], ['mPatches', 'Patches'],
    ];

    document.addEventListener('DOMContentLoaded', function () {
        NWCAForm.init({});
        NWCAFormContacts.attach({ input: document.getElementById('fldCompany') });
        NWCAFormSave.init({ formId: 'customer-onboarding', build: buildSubmission });
        NWCAFormDates.attach('fldPermitExp');
        NWCAForm.staffFill(['fldSalesRep']);
        NWCAForm.autosave({ key: 'customer-onboarding' });

        // "same as billing" copies the address once (stays editable)
        document.getElementById('chkSameAddr').addEventListener('change', function () {
            var ship = document.getElementById('fldShipping');
            if (this.checked && !ship.value.trim()) ship.value = document.getElementById('fldBilling').value;
        });
    });

    function buildSubmission() {
        var V = NWCAFormSave.val;
        var checksList = [];
        TAX_CHECKS.concat(TERM_CHECKS, METHOD_CHECKS).forEach(function (p) {
            if (NWCAFormSave.checked(p[0])) checksList.push(p[1]);
        });
        if (NWCAFormSave.checked('chkSameAddr')) checksList.push('Shipping same as billing');

        var terms = TERM_CHECKS.filter(function (p) { return NWCAFormSave.checked(p[0]); }).map(function (p) { return p[1]; });
        var tax = TAX_CHECKS.filter(function (p) { return NWCAFormSave.checked(p[0]); }).map(function (p) { return p[1]; });

        return {
            company: V('fldCompany'),
            contactName: V('fldContact'),
            phone: V('fldPhone'),
            email: V('fldEmail'),
            customerNumber: '',
            salesRep: V('fldSalesRep'),
            dueDateText: '',
            summary: 'New account · ' + (terms[0] || 'terms not marked') + ' · ' + (tax[0] || 'tax status not marked') +
                     (V('fldFirstOrder') ? ' · first order: ' + V('fldFirstOrder') : ''),
            payload: {
                fields: [
                    ['Company (legal name)', V('fldCompany')], ['DBA / Brand', V('fldDba')],
                    ['Website', V('fldWebsite')], ['Industry', V('fldIndustry')],
                    ['How heard about us', V('fldHeardVia')], ['Assigned Sales Rep', V('fldSalesRep')],
                    ['Primary contact', V('fldContact')], ['Title / Role', V('fldContactTitle')],
                    ['Phone', V('fldPhone')], ['Email', V('fldEmail')],
                    ['AP contact', V('fldApContact')], ['AP email / phone', V('fldApEmail')],
                    ['Billing address', V('fldBilling')], ['Shipping address', V('fldShipping')],
                    ['Reseller permit #', V('fldPermit')], ['Permit expiration', V('fldPermitExp')],
                    ['Logo files', V('fldLogoFiles')], ['First order in mind', V('fldFirstOrder')],
                ],
                checks: checksList,
                tables: [],
                notes: [['Notes', V('fldNotes')]],
            },
        };
    }
})();
