/**
 * nwca-form-dates.js — hybrid date pickers for the fillable form twins.
 *
 * Date fields stay FREE TEXT (people write "ASAP" on these forms) but get a
 * 📅 button that opens the native date picker and writes M/D/YYYY into the
 * text field. Save-time ISO normalizing (nwca-form-save.js toIsoDay) is
 * unchanged — picked dates always normalize cleanly.
 *
 *   NWCAFormDates.attach('fldDateNeeded', 'fldDateIn', …)   // by id
 *   NWCAFormDates.attachEl(inputEl)                          // by element
 *   NWCAFormDates.today()                                    // "7/11/2026"
 *   NWCAFormDates.plusDays(base, 14)                         // date math
 */
(function (global) {
    'use strict';

    function fmt(d) {
        return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
    }

    function today() { return fmt(new Date()); }

    // base: Date | "M/D/YYYY" | "YYYY-MM-DD" | '' (today). Returns M/D/YYYY.
    function plusDays(base, days) {
        var d;
        if (base instanceof Date) d = new Date(base);
        else {
            var s = String(base || '').trim();
            var m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
            var iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
            if (m) d = new Date(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[1] - 1, +m[2]);
            else if (iso) d = new Date(+iso[1], +iso[2] - 1, +iso[3]);
            else d = new Date();
        }
        d.setDate(d.getDate() + days);
        return fmt(d);
    }

    function attachEl(input) {
        if (!input || input.dataset.dateWired) return;
        input.dataset.dateWired = '1';

        var wrap = input.parentNode;
        wrap.classList.add('date-anchor');

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'date-pick-btn no-print';
        btn.setAttribute('aria-label', 'Pick a date');
        btn.innerHTML = '<i class="far fa-calendar"></i>';

        var hidden = document.createElement('input');
        hidden.type = 'date';
        hidden.className = 'date-pick-native';
        hidden.tabIndex = -1;
        hidden.setAttribute('aria-hidden', 'true');

        btn.addEventListener('click', function () {
            if (typeof hidden.showPicker === 'function') {
                try { hidden.showPicker(); return; } catch (_) { /* fall through */ }
            }
            hidden.click();
        });
        hidden.addEventListener('change', function () {
            if (!hidden.value) return;
            var parts = hidden.value.split('-'); // YYYY-MM-DD
            input.value = (+parts[1]) + '/' + (+parts[2]) + '/' + parts[0];
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });

        wrap.appendChild(btn);
        wrap.appendChild(hidden);
    }

    function attach() {
        Array.prototype.forEach.call(arguments, function (id) {
            attachEl(document.getElementById(id));
        });
    }

    global.NWCAFormDates = { attach: attach, attachEl: attachEl, today: today, plusDays: plusDays };
})(window);
