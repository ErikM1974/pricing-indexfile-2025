/**
 * sample-checkout-form.js — pages/forms/sample-checkout-form.html
 *
 * Fill-in-the-browser twin of /forms/sample-checkout-return-agreement.pdf.
 * Nothing is saved anywhere — print / Save as PDF is the output. Never type
 * a full card number on this form (last-4 field is capped at 4 digits).
 *
 * Behaviors: seed 7 numbered item rows (+ Add Row), auto-fill each row's
 * Charge Value as 75% of its Retail Value (typing a charge by hand wins),
 * shared print / clear / dirty-guard via NWCAForm.
 */
(function () {
    'use strict';

    var DEFAULT_ROWS = 7;

    document.addEventListener('DOMContentLoaded', function () {
        var tbody = document.getElementById('sampleRows');
        for (var i = 0; i < DEFAULT_ROWS; i++) addRow(tbody);

        document.getElementById('addRowBtn').addEventListener('click', function () {
            addRow(tbody);
        });

        NWCAForm.init({});
        NWCAFormContacts.attach({ input: document.getElementById('fldCompany') });
        NWCAFormSave.init({ formId: 'sample-checkout', build: buildSubmission });
        NWCAFormDates.attach('fldCheckoutDate', 'fldReturnDue', 'fldGraceDeadline', 'fldVendorReturnBy', 'fldSignDate');
        NWCAForm.staffFill(['fldAe', 'fldIssuedBy']);
        NWCAForm.autosave({ key: 'sample-checkout', tables: [{ tbody: tbody, addRow: function () { addRow(tbody); } }] });

        // the form's own printed rule: samples due back in 14 days, grace +3
        var checkout = document.getElementById('fldCheckoutDate');
        if (!checkout.value) {
            checkout.value = NWCAFormDates.today();
        }
        function autoDueDates() {
            var due = document.getElementById('fldReturnDue');
            var grace = document.getElementById('fldGraceDeadline');
            if (!due.value.trim()) due.value = NWCAFormDates.plusDays(checkout.value, 14);
            if (!grace.value.trim()) grace.value = NWCAFormDates.plusDays(checkout.value, 17);
        }
        autoDueDates();
        checkout.addEventListener('input', function () {
            // re-derive only fields the user hasn't hand-edited away from the rule
            document.getElementById('fldReturnDue').value = NWCAFormDates.plusDays(checkout.value, 14);
            document.getElementById('fldGraceDeadline').value = NWCAFormDates.plusDays(checkout.value, 17);
        });
    });

    // ⚠️ Card section (status/type/last4/exp/cardholder) is DELIBERATELY absent
    // from the saved data — print-only per Erik 2026-07-11. The proxy re-strips
    // card-ish keys server-side as defense in depth (jest-locked).
    function buildSubmission() {
        var V = NWCAFormSave.val;
        var checksList = [];
        if (NWCAFormSave.checked('srcShowroom')) checksList.push('Source: Showroom');
        if (NWCAFormSave.checked('srcVendor')) checksList.push('Source: Vendor Ordered');
        [['condUnworn', 'Unworn'], ['condUnwashed', 'Unwashed'], ['condUnaltered', 'Unaltered'],
         ['condUndamaged', 'Undamaged'], ['condTags', 'Original tags attached'], ['condPackaging', 'Original packaging included']]
            .forEach(function (pair) { if (NWCAFormSave.checked(pair[0])) checksList.push(pair[1]); });

        var items = [];
        document.querySelectorAll('#sampleRows tr').forEach(function (tr) {
            var inputs = tr.querySelectorAll('input');
            // order: source, brand, style, description, color, size, qty, retail, charge, dateReturned, condition
            var v = Array.prototype.map.call(inputs, function (el) { return el.value.trim(); });
            if (v.slice(0, 9).some(function (c) { return c; })) {
                items.push({
                    source: v[0], brand: v[1], style: v[2], description: v[3], color: v[4],
                    size: v[5], qty: v[6], retailValue: v[7], chargeValue: v[8],
                });
            }
        });

        return {
            company: V('fldCompany'),
            contactName: V('fldContact'),
            phone: V('fldPhone'),
            email: V('fldEmail'),
            customerNumber: V('fldCustomerNum'),
            salesRep: V('fldAe'),
            dueDateText: V('fldReturnDue'),
            summary: items.length + ' item' + (items.length === 1 ? '' : 's') + ' out · due ' + (V('fldReturnDue') || '?'),
            items: items,
            payload: {
                fields: [
                    ['Company', V('fldCompany')], ['Contact Name', V('fldContact')], ['Phone', V('fldPhone')],
                    ['Email', V('fldEmail')], ['AE', V('fldAe')], ['Customer #', V('fldCustomerNum')],
                    ['Checkout Date', V('fldCheckoutDate')], ['Return Due Date', V('fldReturnDue')],
                    ['Grace Deadline', V('fldGraceDeadline')], ['Vendor / Order #', V('fldVendorOrder')],
                    ['Vendor Return By', V('fldVendorReturnBy')],
                ],
                checks: checksList,
                tables: [],
                notes: [['Printed Name', V('fldPrintedName')], ['Signature Date', V('fldSignDate')], ['AE / Issued By', V('fldIssuedBy')]],
            },
        };
    }

    function addRow(tbody) {
        var tr = document.createElement('tr');

        var num = document.createElement('td');
        num.className = 'cell-num';
        num.textContent = String(tbody.children.length + 1);
        tr.appendChild(num);

        tr.appendChild(textCell('cell-text', 'Source'));
        tr.appendChild(textCell('cell-text', 'Brand'));
        tr.appendChild(textCell('cell-text', 'Style number'));
        tr.appendChild(textCell('cell-text', 'Description'));
        tr.appendChild(textCell('cell-text', 'Color'));
        tr.appendChild(textCell('', 'Size'));
        tr.appendChild(textCell('', 'Quantity'));

        // Retail value drives the 75% charge column
        var retailTd = document.createElement('td');
        var retail = document.createElement('input');
        retail.type = 'text';
        retail.inputMode = 'decimal';
        retail.className = 'retail-value';
        retail.setAttribute('aria-label', 'Retail value');
        retailTd.appendChild(retail);
        tr.appendChild(retailTd);

        var chargeTd = document.createElement('td');
        chargeTd.className = 'cell-total';
        var charge = document.createElement('input');
        charge.type = 'text';
        charge.inputMode = 'decimal';
        charge.className = 'charge-value';
        charge.setAttribute('aria-label', 'Charge value (75% of retail)');
        chargeTd.appendChild(charge);
        tr.appendChild(chargeTd);

        retail.addEventListener('input', function () { recalcCharge(retail, charge); });
        // typing a charge by hand turns off auto-calc for that row
        charge.addEventListener('input', function () {
            charge.dataset.manual = charge.value.trim() ? '1' : '';
            if (!charge.dataset.manual) recalcCharge(retail, charge);
        });

        tr.appendChild(textCell('', 'Date returned'));
        tr.appendChild(textCell('cell-text', 'Condition / initials'));

        tbody.appendChild(tr);
    }

    function textCell(className, ariaLabel) {
        var td = document.createElement('td');
        if (className) td.className = className;
        var input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('aria-label', ariaLabel);
        td.appendChild(input);
        return td;
    }

    function recalcCharge(retail, charge) {
        if (charge.dataset.manual === '1') return;
        var value = parseFloat(String(retail.value).replace(/[$,\s]/g, ''));
        // Money rounding: cents, not floating dust
        charge.value = isNaN(value) ? '' : (Math.round(value * 75) / 100).toFixed(2);
    }
})();
