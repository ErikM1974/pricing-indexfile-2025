/* Steve's Dashboard — Send to Screen Print button handler
 *
 * Mirrors steve-send-supacolor.js but opens the modal in 'Screen Print' mode
 * for orders going to L&P Printing (NWCA's subcontract screen-print vendor —
 * Ed's shop). L&P has no API, so this is a pure file/info handoff to Bradley
 * with manual status transitions.
 *
 * Depends on: transfer-actions-shared.js (window.TransferActions)
 */

var STEVSENDSCRE_LOG_ON = (typeof window !== 'undefined' && !!window.location && (window.location.hostname === 'localhost' || new URLSearchParams(window.location.search).has('debug')));
var stevsendscreLog = STEVSENDSCRE_LOG_ON ? console.log.bind(console) : function () {}; // debug logging: localhost or ?debug=1 only (2026-09-06 console sweep)
(function () {
    'use strict';

    // Steve uses the shared art-dept alias — no individual steve@ exists.
    var STEVE_USER = {
        email: 'art@nwcustomapparel.com',
        name: 'Steve Deland'
    };

    function onSendScreenPrintClick() {
        if (!window.TransferActions) {
            alert('TransferActions helper not loaded. Please refresh.');
            return;
        }

        window.TransferActions.openSendModal({
            method: 'Screen Print',
            requestedBy: STEVE_USER,
            enableLines: true,
            onSuccess: function (record) {
                stevsendscreLog('Screen-print transfer created:', record.ID_Transfer);
            }
        });
    }

    function init() {
        var btn = document.getElementById('steve-send-screenprint-btn');
        if (!btn) return;
        btn.addEventListener('click', onSendScreenPrintClick);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
