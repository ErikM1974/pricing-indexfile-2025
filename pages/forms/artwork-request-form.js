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
    });
})();
