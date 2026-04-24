/* Steve's Dashboard — Send to Supacolor button handler
 *
 * v3 paste-links flow (2026-04-24): button opens the modal directly. Design
 * number + customer + sales rep all come from pasting the Box URLs — the
 * filename carries the design# and customer, the mockup carries the sales rep
 * via Claude vision. No need to prompt Steve for anything up front.
 *
 * Depends on: transfer-actions-shared.js (window.TransferActions)
 */

(function () {
    'use strict';

    // Steve is always Steve on this dashboard — preset identity so the
    // modal doesn't prompt for email on submit.
    var STEVE_USER = {
        email: 'steve@nwcustomapparel.com',
        name: 'Steve Deland'
    };

    function onSendSupacolorClick() {
        if (!window.TransferActions) {
            alert('TransferActions helper not loaded. Please refresh.');
            return;
        }

        window.TransferActions.openSendModal({
            requestedBy: STEVE_USER,
            // Steve's dashboard is the canonical paste-links caller.
            // Mockup-detail and art-request-detail callers still use
            // openSendModal with their own opts (legacy single-line paths).
            enableLines: true,
            onSuccess: function (record) {
                console.log('Transfer created:', record.ID_Transfer);
            }
        });
    }

    function init() {
        var btn = document.getElementById('steve-send-supacolor-btn');
        if (!btn) return;
        btn.addEventListener('click', onSendSupacolorClick);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
