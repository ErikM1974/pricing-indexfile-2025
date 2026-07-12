/**
 * credit-card-auth-form.js — pages/forms/credit-card-auth-form.html
 *
 * 2026 replacement for the 2015 CC-auth PDF (which had full-PAN + CVV blanks —
 * storing CVV post-auth is prohibited by PCI DSS 3.2, and a written PAN is a
 * breach liability). This form captures card IDENTITY only:
 *   - "Ending in" is hard-limited to 4 digits — pasting a full card number
 *     keeps only the LAST 4, so a PAN can't even transiently persist here
 *   - a save-time sweep blocks ANY field containing 13+ consecutive digits
 *     (card numbers are 13–19; phones are 10–11 so they pass)
 *   - the server re-strips card-ish labels for this formId (jest-locked)
 * The actual number is taken by phone (keyed direct), secure payment link,
 * or in person — spelled out on the form itself.
 * Save to NWCA → Forms Inbox (CCA prefix); Due_Date = card good-through
 * (last day of that month) so the renewal flag fires like the tax certs.
 */
(function () {
    'use strict';

    var TYPE_CHECKS = [
        ['ctVisa', 'Visa'], ['ctMc', 'Mastercard'], ['ctAmex', 'American Express'], ['ctDiscover', 'Discover'],
    ];
    var VIA_CHECKS = [
        ['viaPhone', 'Card added via phone (keyed direct)'],
        ['viaLink', 'Card added via secure payment link'],
        ['viaPerson', 'Card added in person'],
    ];

    document.addEventListener('DOMContentLoaded', function () {
        NWCAForm.init({});
        NWCAFormContacts.attach({ input: document.getElementById('fldCompany') });
        NWCAFormSave.init({ formId: 'credit-card-auth', build: buildSubmission });
        NWCAFormDates.attach('fldVerifiedDate');
        NWCAForm.staffFill(['fldSalesRep']);
        NWCAForm.autosave({ key: 'credit-card-auth' });

        // "Ending in": digits only, and a paste of a FULL card number keeps
        // only the last 4 — the full PAN never survives in the field
        var ending = document.getElementById('fldEnding');
        ending.addEventListener('input', function () {
            var digits = ending.value.replace(/\D/g, '');
            ending.value = digits.length > 4 ? digits.slice(-4) : digits;
        });

        // Good through: auto-format MM/YY while typing
        var thru = document.getElementById('fldGoodThru');
        thru.addEventListener('input', function () {
            var d = thru.value.replace(/\D/g, '').slice(0, 4);
            thru.value = d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d;
        });
    });

    // Save-time sweep: card numbers are 13–19 digits; NOTHING on this form
    // legitimately holds 13+ consecutive digits (phones are 10–11). Any hit
    // blocks the save with a banner naming the field.
    function guardNoPan() {
        var offender = null;
        document.querySelectorAll('.form-sheet input[type="text"], .form-sheet textarea').forEach(function (el) {
            if (offender) return;
            var normalized = el.value.replace(/[\s-]/g, '');
            if (/\d{13,}/.test(normalized)) offender = el;
        });
        var banner = document.querySelector('.pan-block-banner');
        if (!offender) { if (banner) banner.remove(); return; }
        if (!banner) {
            banner = document.createElement('div');
            banner.className = 'pan-block-banner no-print';
            var sheet = document.querySelector('.form-sheet');
            sheet.parentNode.insertBefore(banner, sheet);
        }
        var label = offender.closest('.info-field');
        var labelText = label && label.querySelector('label') ? label.querySelector('label').textContent : 'a field';
        banner.innerHTML = '<i class="fas fa-shield-halved"></i> <strong>NOT saved — that looks like a full card number</strong> in "' +
            escapeHtml(labelText.trim()) + '". Remove it: we only record the last 4 digits. ' +
            'Take the number by phone (keyed direct) or the secure payment link.';
        banner.scrollIntoView({ block: 'center', behavior: 'smooth' });
        offender.focus();
        throw new Error('full card number detected — save blocked');
    }

    // MM/YY → last day of that month, as M/D/YYYY (NWCAFormSave.toIsoDay
    // normalizes it) — the Inbox renewal flag fires as the card expires
    function goodThruDueDate(mmYy) {
        var m = /^(\d{1,2})\/(\d{2})$/.exec(String(mmYy || '').trim());
        if (!m) return '';
        var month = parseInt(m[1], 10);
        if (month < 1 || month > 12) return '';
        var year = 2000 + parseInt(m[2], 10);
        var lastDay = new Date(year, month, 0).getDate();
        return month + '/' + lastDay + '/' + year;
    }

    function buildSubmission() {
        guardNoPan();
        var V = NWCAFormSave.val;
        var checksList = [];
        TYPE_CHECKS.concat(VIA_CHECKS).forEach(function (p) {
            if (NWCAFormSave.checked(p[0])) checksList.push(p[1]);
        });

        var type = TYPE_CHECKS.filter(function (p) { return NWCAFormSave.checked(p[0]); }).map(function (p) { return p[1]; });
        var authUsers = [V('fldAuth1'), V('fldAuth2')].filter(Boolean);

        return {
            company: V('fldCompany'),
            contactName: V('fldCardholder'),
            phone: V('fldPhone'),
            email: V('fldEmail'),
            customerNumber: '',
            salesRep: V('fldSalesRep'),
            dueDateText: goodThruDueDate(V('fldGoodThru')),
            summary: (type[0] || 'card type not marked') + (V('fldEnding') ? ' ending ' + V('fldEnding') : '') +
                     (V('fldGoodThru') ? ' · good thru ' + V('fldGoodThru') : '') +
                     ' · ' + authUsers.length + ' authorized user' + (authUsers.length === 1 ? '' : 's'),
            payload: {
                fields: [
                    ['Customer / Company', V('fldCompany')], ['Sales / CS Rep', V('fldSalesRep')],
                    ['Cardholder name', V('fldCardholder')], ['Issuing bank', V('fldBank')],
                    ['Ending in', V('fldEnding')], ['Good through (MM/YY)', V('fldGoodThru')],
                    ['Billing street address', V('fldBillAddress')], ['Billing city / state / zip', V('fldBillCityStZip')],
                    ['Phone', V('fldPhone')], ['Email', V('fldEmail')],
                    ['Ship-to 1 name', V('fldShip1Name')], ['Ship-to 1 address', V('fldShip1Addr')],
                    ['Ship-to 1 city / state / zip', V('fldShip1CityStZip')], ['Ship-to 1 phone', V('fldShip1Phone')],
                    ['Ship-to 2 name', V('fldShip2Name')], ['Ship-to 2 address', V('fldShip2Addr')],
                    ['Ship-to 2 city / state / zip', V('fldShip2CityStZip')], ['Ship-to 2 phone', V('fldShip2Phone')],
                    ['Authorized user 1', V('fldAuth1')], ['Authorized user 2', V('fldAuth2')],
                    ['Verified & added by', V('fldVerifiedBy')], ['Verified date', V('fldVerifiedDate')],
                ],
                checks: checksList,
                tables: [],
                notes: [],
            },
        };
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
})();
