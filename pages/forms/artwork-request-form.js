/**
 * artwork-request-form.js — pages/forms/artwork-request-form.html
 *
 * Fill-in-the-browser twin of /forms/custom-artwork-request-form.pdf.
 * Nothing is saved anywhere — print / Save as PDF is the output.
 * All behavior (print, clear, dirty guard) comes from nwca-form-shared.js;
 * this form has no tables or computed fields.
 */
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        NWCAForm.init({});
        NWCAFormContacts.attach({ input: document.getElementById('fldCompany') });
        NWCAFormSave.init({ formId: 'artwork-request', build: buildSubmission });
        NWCAFormDates.attach('fldDateRequested', 'fldDueDate', 'fldSignDate');
        if (!document.getElementById('fldDateRequested').value) document.getElementById('fldDateRequested').value = NWCAFormDates.today();
        NWCAForm.staffFill(['fldSalesRep', 'fldReceivedBy']);
        NWCAForm.autosave({ key: 'artwork-request' });
    });

    function buildSubmission() {
        var V = NWCAFormSave.val;
        var types = [];
        [['typeDtg', 'T-Shirt / DTG'], ['typeEmbroidery', 'Embroidery'], ['typeTransfers', 'Transfers'], ['typeStickers', 'Stickers'],
         ['typeBanner', 'Banner'], ['typeLaser', 'Laser Engraving'], ['typePatch', 'Patch']]
            .forEach(function (pair) { if (NWCAFormSave.checked(pair[0])) types.push(pair[1]); });
        if (NWCAFormSave.checked('typeOther')) types.push('Other: ' + (V('typeOtherText') || '?'));
        if (NWCAFormSave.checked('refArtYes')) types.push('Reference art provided');
        if (NWCAFormSave.checked('logoYes')) types.push('Existing logo provided');

        return {
            company: V('fldCompany'),
            contactName: V('fldContact'),
            phone: V('fldPhone'),
            email: V('fldEmail'),
            customerNumber: V('fldCustomerNum'),
            salesRep: V('fldSalesRep'),
            dueDateText: V('fldDueDate'),
            summary: (V('fldProjectName') || 'Art request') + (types.length ? ' · ' + types[0] : '') +
                     (V('fldBudget') ? ' · $' + V('fldBudget') : ''),
            payload: {
                fields: [
                    ['Company', V('fldCompany')], ['Contact Name', V('fldContact')], ['Phone', V('fldPhone')],
                    ['Email', V('fldEmail')], ['Sales Rep', V('fldSalesRep')], ['Date Requested', V('fldDateRequested')],
                    ['Due Date', V('fldDueDate')], ['PO #', V('fldPo')], ['Customer #', V('fldCustomerNum')],
                    ['Project Name / Event', V('fldProjectName')], ['Item or Garment Type', V('fldGarmentType')],
                    ['Quantity', V('fldQuantity')], ['Decoration Location', V('fldDecoLocation')],
                    ['Size of Artwork', V('fldArtSize')], ['Intended Audience / Use', V('fldAudience')],
                    ['Exact Text to Include', V('fldExactText')], ['Preferred Colors', V('fldColors')],
                    ['Font / Style Preferences', V('fldFonts')], ['Graphic Elements to Include', V('fldGraphics')],
                    ['Must Avoid', V('fldAvoid')], ['Art Budget $', V('fldBudget')],
                ],
                checks: types,
                tables: [],
                notes: [
                    ['Sketch / Layout Notes', V('fldSketch')],
                    ['Additional Notes', V('fldNotes')],
                    ['Printed Name', V('fldPrintedName')], ['Signature Date', V('fldSignDate')], ['NWCA Received By', V('fldReceivedBy')],
                ],
            },
        };
    }
})();
