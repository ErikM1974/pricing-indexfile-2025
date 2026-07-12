/**
 * credit-application-form.js — pages/forms/credit-application-form.html
 *
 * Net 15 / Net 30 terms application: business info, AP contact, requested
 * limit, 3 trade references, bank REFERENCE (contact only — the form and a
 * screen banner both say NO account numbers; we never want them in Caspio).
 * Print for signature; Save to NWCA → Forms Inbox (CRD prefix, default
 * status "Under Review"). Approved terms get typed into the customer's
 * Payment_Terms so the contacts intel banner shows them on every form.
 */
(function () {
    'use strict';

    var REF_ROWS = 3;

    var ENTITY_CHECKS = [
        ['entLlc', 'LLC'], ['entCorp', 'Corporation'], ['entSole', 'Sole proprietor'],
        ['entPartner', 'Partnership'], ['entGov', 'Government'], ['entNonprofit', 'Nonprofit'],
    ];

    document.addEventListener('DOMContentLoaded', function () {
        var tbody = document.getElementById('refRows');
        for (var i = 0; i < REF_ROWS; i++) addRefRow(tbody);

        NWCAForm.init({});
        NWCAFormContacts.attach({ input: document.getElementById('fldCompany') });
        NWCAFormSave.init({ formId: 'credit-application', build: buildSubmission });
        NWCAForm.autosave({ key: 'credit-application', tables: [{ tbody: tbody, addRow: function () { addRefRow(tbody); } }] });
    });

    function addRefRow(tbody) {
        var tr = document.createElement('tr');
        ['Reference company', 'Reference contact', 'Reference phone', 'Reference email'].forEach(function (label) {
            var td = document.createElement('td');
            td.className = 'cell-text';
            var input = document.createElement('input');
            input.type = 'text';
            input.setAttribute('aria-label', label);
            td.appendChild(input);
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    }

    function buildSubmission() {
        var V = NWCAFormSave.val;
        var checksList = [];
        ENTITY_CHECKS.forEach(function (p) { if (NWCAFormSave.checked(p[0])) checksList.push(p[1]); });
        if (NWCAFormSave.checked('reqNet15')) checksList.push('Net 15 requested');
        if (NWCAFormSave.checked('reqNet30')) checksList.push('Net 30 requested');

        var rows = [];
        document.querySelectorAll('#refRows tr').forEach(function (tr) {
            var cells = Array.prototype.map.call(tr.querySelectorAll('input'), function (el) { return el.value.trim(); });
            if (cells.some(function (c) { return c; })) rows.push(cells);
        });

        var terms = NWCAFormSave.checked('reqNet30') ? 'Net 30' : (NWCAFormSave.checked('reqNet15') ? 'Net 15' : 'terms not marked');

        return {
            company: V('fldCompany'),
            contactName: V('fldContact'),
            phone: V('fldPhone'),
            email: V('fldEmail'),
            customerNumber: '',
            salesRep: '',
            dueDateText: '',
            summary: terms + ' requested · limit $' + (V('fldLimit') || '?') + '/mo · ' + rows.length + ' trade ref' + (rows.length === 1 ? '' : 's'),
            payload: {
                fields: [
                    ['Legal business name', V('fldCompany')], ['DBA / Trade name', V('fldDba')],
                    ['Years in business', V('fldYears')], ['WA UBI #', V('fldUbi')],
                    ['Website', V('fldWebsite')], ['Owner / Principal', V('fldOwner')],
                    ['AP contact', V('fldContact')], ['AP phone', V('fldPhone')],
                    ['AP / invoice email', V('fldEmail')], ['Billing address', V('fldBilling')],
                    ['Requested limit $/mo', V('fldLimit')], ['Expected monthly volume $', V('fldVolume')],
                    ['Bank name', V('fldBankName')], ['Bank branch / city', V('fldBankBranch')],
                    ['Bank contact / phone', V('fldBankPhone')],
                ],
                checks: checksList,
                tables: [{
                    title: 'Trade References',
                    columns: ['Company', 'Contact', 'Phone', 'Email'],
                    rows: rows,
                }],
                notes: [],
            },
        };
    }
})();
