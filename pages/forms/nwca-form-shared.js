/**
 * nwca-form-shared.js — shared behaviors for the fillable form twins in
 * /pages/forms/. Extracted 2026-07-11 from garment-drop-off-form.js.
 *
 * Nothing is saved anywhere — these forms are fill → Print / Save as PDF only.
 *
 * Each form page calls NWCAForm.init({ onAfterClear }) after building its DOM:
 *   - wires #printFormBtn → window.print()
 *   - wires #clearFormBtn → confirm, blank every input/checkbox/textarea,
 *     drop data-manual flags, then onAfterClear() for form-specific resets
 *   - tracks dirty state → beforeunload guard (cleared after printing)
 */
(function (global) {
    'use strict';

    var dirty = false;

    function init(opts) {
        opts = opts || {};

        var printBtn = document.getElementById('printFormBtn');
        if (printBtn) {
            printBtn.addEventListener('click', function () { window.print(); });
        }

        var clearBtn = document.getElementById('clearFormBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', function () {
                if (!window.confirm('Clear everything typed into this form?')) return;
                document.querySelectorAll('input[type="text"], input[type="tel"], input[type="email"], input[type="number"], textarea')
                    .forEach(function (el) { el.value = ''; delete el.dataset.manual; });
                document.querySelectorAll('input[type="checkbox"]').forEach(function (el) { el.checked = false; });
                dirty = false;
                if (typeof opts.onAfterClear === 'function') opts.onAfterClear();
            });
        }

        document.addEventListener('input', function () { dirty = true; });
        window.addEventListener('beforeunload', function (e) {
            if (!dirty) return;
            e.preventDefault();
            e.returnValue = '';
        });
        window.addEventListener('afterprint', function () { dirty = false; });
    }

    // Successful Save-to-NWCA clears the leave-warning (nwca-form-save.js)
    function markClean() { dirty = false; }

    global.NWCAForm = { init: init, markClean: markClean };
})(window);
