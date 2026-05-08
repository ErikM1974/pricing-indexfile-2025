/**
 * NWCA Date Utils — small generic date helpers (not Caspio-specific).
 * For Caspio timestamp parsing see caspio-date-utils.js.
 */
(function (global) {
    'use strict';

    /**
     * Today + N business days (skip Saturdays/Sundays). Returns a string in
     * YYYY-MM-DD format suitable for <input type="date"> defaults.
     *
     * Holidays are NOT skipped — overkill for the AE intake-form lead-time
     * defaults (~2-day art turnaround). The AE can override the default.
     */
    function addBusinessDays(n) {
        var d = new Date();
        var added = 0;
        while (added < n) {
            d.setDate(d.getDate() + 1);
            var dow = d.getDay();
            if (dow !== 0 && dow !== 6) added++;
        }
        var yyyy = d.getFullYear();
        var mm = String(d.getMonth() + 1).padStart(2, '0');
        var dd = String(d.getDate()).padStart(2, '0');
        return yyyy + '-' + mm + '-' + dd;
    }

    global.NWCA_DateUtils = {
        addBusinessDays: addBusinessDays
    };

})(typeof window !== 'undefined' ? window : this);
